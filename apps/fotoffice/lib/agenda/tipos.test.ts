import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const T = await import("./tipos");
const S = await import("./semillas");
const { MENSAJES_AGENDA: M } = await import("./acceso");
const { TIPOS_DE_CITA_INICIALES } = await import("./constantes");

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { agenda: "MANAGE" } } as never };
const STAFF = { workspaceId: "ws-1", userId: 2, userLabel: "Staff", role: "STAFF", acceso: { role: "STAFF", levels: { agenda: "MANAGE" } } as never };
const tipos = () => B.datos.fotofficeCitaTipo;

beforeEach(() => B.vaciar());

describe("tipos de cita", () => {
  it("el dueño crea tipos con color, en orden y sin repetir el nombre (sin mayúsculas)", async () => {
    const a = await T.crearTipo(DUENO, { name: "  Sesión   de fotos ", color: "#16A34A" });
    const b = await T.crearTipo(DUENO, { name: "Reunión" });
    expect(a.ok && b.ok).toBe(true);
    expect(tipos().map((t) => [t.name, t.color, t.order, t.workspaceId])).toEqual([
      ["Sesión de fotos", "#16a34a", 0, "ws-1"],
      ["Reunión", "#6b7280", 1, "ws-1"],
    ]);
    expect(await T.crearTipo(DUENO, { name: "sesión de fotos" })).toEqual({ ok: false, error: M.tipoRepetido });
  });

  it("valida nombre y color; configurar es sólo de quien administra", async () => {
    expect(await T.crearTipo(DUENO, { name: " " })).toEqual({ ok: false, error: M.tipoNombre });
    expect(await T.crearTipo(DUENO, { name: "x".repeat(81) })).toEqual({ ok: false, error: M.tipoNombre });
    expect(await T.crearTipo(DUENO, { name: "A", color: "rojo" })).toEqual({ ok: false, error: M.tipoColor });
    expect(await T.crearTipo(DUENO, { name: "A", color: "#12345" })).toEqual({ ok: false, error: M.tipoColor });
    expect(await T.crearTipo(STAFF, { name: "A" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(tipos()).toHaveLength(0);
  });

  it("edita nombre, color, orden y baja; la baja no borra y el listado oculta los dados de baja", async () => {
    const a = await T.crearTipo(DUENO, { name: "A" });
    const b = await T.crearTipo(DUENO, { name: "B" });
    if (!a.ok || !b.ok) throw new Error("no creó");
    expect(await T.editarTipo(DUENO, a.id, { name: "B" })).toEqual({ ok: false, error: M.tipoRepetido });
    expect(await T.editarTipo(DUENO, a.id, { name: "Alfa", color: "#ff0000", order: 5 })).toEqual({ ok: true });
    expect(await T.editarTipo(DUENO, b.id, { isActive: false })).toEqual({ ok: true });
    expect(tipos()).toHaveLength(2);
    expect((await T.listarTipos(DUENO)).map((t) => [t.name, t.color, t.order])).toEqual([["Alfa", "#ff0000", 5]]);
    expect((await T.listarTipos(DUENO, { conBajas: true })).map((t) => t.name)).toEqual(["B", "Alfa"]);
    expect(await T.editarTipo(DUENO, a.id, {})).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await T.editarTipo(DUENO, a.id, { color: "x" })).toEqual({ ok: false, error: M.tipoColor });
    expect(await T.editarTipo(STAFF, a.id, { name: "Z" })).toEqual({ ok: false, error: M.sinPermiso });
  });

  it("no toca tipos de otro workspace", async () => {
    B.agregar("fotofficeCitaTipo", { id: "t-ajeno", workspaceId: "ws-2", name: "Ajeno" });
    expect(await T.editarTipo(DUENO, "t-ajeno", { name: "Mío" })).toEqual({ ok: false, error: M.tipoNoExiste });
    expect(tipos()[0]!.name).toBe("Ajeno");
    expect(await T.listarTipos(DUENO, { conBajas: true })).toEqual([]);
  });
});

describe("semilla de tipos de DNX", () => {
  it("siembra los seis tipos con sus colores, sólo en DNX", async () => {
    expect(await S.asegurarTiposCitaDnx("ws-1", "otra-institucion")).toBe(0);
    expect(await S.asegurarTiposCitaDnx("ws-1", null)).toBe(0);
    expect(tipos()).toHaveLength(0);
    expect(await S.asegurarTiposCitaDnx("ws-1", "dnxestudio")).toBe(6);
    expect(tipos().map((t) => [t.name, t.color])).toEqual([
      ["Reunión con cliente", "#2563eb"],
      ["Evento", "#dc2626"],
      ["Sesión de fotos", "#16a34a"],
      ["Entrega", "#7c3aed"],
      ["Prueba / ensayo", "#ea580c"],
      ["Otro", "#6b7280"],
    ]);
    expect(tipos().map((t) => t.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("es idempotente: no duplica, completa lo que falta y no reactiva uno dado de baja", async () => {
    await S.asegurarTiposCitaDnx("ws-1", "dnxestudio");
    expect(await S.asegurarTiposCitaDnx("ws-1", "dnxestudio")).toBe(0);
    tipos().find((t) => t.name === "Otro")!.isActive = false;
    tipos().splice(tipos().findIndex((t) => t.name === "Evento"), 1);
    expect(await S.asegurarTiposCitaDnx("ws-1", "dnx-estudio")).toBe(1);
    expect(tipos()).toHaveLength(6);
    expect(tipos().find((t) => t.name === "Otro")!.isActive).toBe(false);
    expect(tipos().find((t) => t.name === "Evento")!.order).toBe(6);
  });

  it("los faltantes se comparan sin mayúsculas y la lista inicial son seis", () => {
    expect(S.tiposFaltantes(["EVENTO ", "otro"]).map((t) => t.name)).toEqual(["Reunión con cliente", "Sesión de fotos", "Entrega", "Prueba / ensayo"]);
    expect(TIPOS_DE_CITA_INICIALES).toHaveLength(6);
  });
});
