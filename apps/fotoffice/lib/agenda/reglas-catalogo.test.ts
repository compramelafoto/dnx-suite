import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const R = await import("./reglas-catalogo");

const regla = (extra: Record<string, unknown> = {}) => ({ typeId: null, title: null, daysFromEvent: 0, startTime: null, durationMinutes: 60, ownerUserId: null, ...extra });
const filas = () => B.datos.fotofficeProductoCita;

beforeEach(() => {
  B.vaciar();
  B.agregar("product", { id: "prod-1", workspaceId: "ws-1", name: "Álbum" });
  B.agregar("product", { id: "prod-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("fotofficeCitaTipo", { id: "t-1", workspaceId: "ws-1", name: "Sesión de fotos" });
  B.agregar("fotofficeCitaTipo", { id: "t-baja", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeCitaTipo", { id: "t-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
});

describe("normalizarReglas", () => {
  it("acepta una regla completa y limpia el título", () => {
    expect(R.normalizarReglas([regla({ typeId: "t-1", title: "  {producto} de {contacto}  ", daysFromEvent: -365, startTime: "18:30", durationMinutes: 1440, ownerUserId: 7 })])).toEqual({
      ok: true,
      valor: [{ typeId: "t-1", title: "{producto} de {contacto}", daysFromEvent: -365, startTime: "18:30", durationMinutes: 1440, ownerUserId: 7 }],
    });
    expect(R.normalizarReglas([regla({ title: "   ", startTime: "" })])).toMatchObject({ ok: true, valor: [{ title: null, startTime: null }] });
    expect(R.normalizarReglas([])).toEqual({ ok: true, valor: [] });
  });

  it("días de -365 a 365, duración de 15 a 1440 y hora HH:MM", () => {
    for (const d of [366, -366, 1.5, "3", NaN, null]) {
      expect(R.normalizarReglas([regla({ daysFromEvent: d })])).toMatchObject({ ok: false, error: expect.stringContaining("-365 y 365") });
    }
    for (const d of [14, 1441, 30.5, "60", NaN, null]) {
      expect(R.normalizarReglas([regla({ durationMinutes: d })])).toMatchObject({ ok: false, error: expect.stringContaining("15 y 1440") });
    }
    expect(R.normalizarReglas([regla({ durationMinutes: 15 })]).ok).toBe(true);
    for (const h of ["24:00", "9:30", "18:60", "tarde", 1830]) {
      expect(R.normalizarReglas([regla({ startTime: h })])).toMatchObject({ ok: false, error: expect.stringContaining("hora") });
    }
  });

  it("valida responsable, título y variables, y el tope por producto; se puede repetir el tipo", () => {
    expect(R.normalizarReglas([regla({ ownerUserId: 0 })]).ok).toBe(false);
    expect(R.normalizarReglas([regla({ ownerUserId: "7" })]).ok).toBe(false);
    expect(R.normalizarReglas([regla({ title: "{cliente}" })])).toMatchObject({ ok: false, error: expect.stringContaining("{cliente}") });
    expect(R.normalizarReglas([regla({ title: "x".repeat(201) })]).ok).toBe(false);
    expect(R.normalizarReglas([regla({ typeId: "t-1" }), regla({ typeId: "t-1" })]).ok).toBe(true);
    expect(R.normalizarReglas(Array.from({ length: 11 }, () => regla())).ok).toBe(false);
  });
});

describe("guardar y leer las reglas de un producto", () => {
  it("guarda varias, en orden, y las lee con el nombre del tipo", async () => {
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ typeId: "t-1", ownerUserId: 7, daysFromEvent: 30, startTime: "10:00", durationMinutes: 45 }), regla({ title: "Entrega" })])).toEqual({ ok: true });
    expect(filas().map((f) => [f.order, f.workspaceId, f.productId])).toEqual([[0, "ws-1", "prod-1"], [1, "ws-1", "prod-1"]]);
    expect(await R.leerReglas("ws-1", "prod-1")).toEqual([
      expect.objectContaining({ typeId: "t-1", typeName: "Sesión de fotos", typeActive: true, ownerUserId: 7, daysFromEvent: 30, startTime: "10:00", durationMinutes: 45 }),
      expect.objectContaining({ typeId: null, typeName: null, title: "Entrega", startTime: null, durationMinutes: 60 }),
    ]);
  });

  it("guardar reemplaza lo anterior y una lista vacía las borra", async () => {
    await R.guardarReglas("ws-1", "prod-1", [regla(), regla({ title: "B" })]);
    await R.guardarReglas("ws-1", "prod-1", [regla({ daysFromEvent: 5 })]);
    expect(filas().map((f) => f.daysFromEvent)).toEqual([5]);
    await R.guardarReglas("ws-1", "prod-1", []);
    expect(filas()).toHaveLength(0);
  });

  it("un tipo de otro workspace, inexistente o dado de baja (si era nuevo) se rechaza", async () => {
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ typeId: "t-ajeno" })])).toMatchObject({ ok: false, error: expect.stringContaining("Fila 1") });
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ typeId: "nada" })])).toMatchObject({ ok: false });
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ typeId: "t-baja" })])).toMatchObject({ ok: false });
    expect(filas()).toHaveLength(0);
    // Si la regla ya lo usaba, un tipo dado de baja se conserva.
    B.agregar("fotofficeProductoCita", { workspaceId: "ws-1", productId: "prod-1", typeId: "t-baja" });
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ typeId: "t-baja", daysFromEvent: 2 })])).toEqual({ ok: true });
    expect(await R.leerReglas("ws-1", "prod-1")).toEqual([expect.objectContaining({ typeActive: false, typeName: "Viejo" })]);
  });

  it("un responsable fuera del equipo y un producto ajeno se rechazan, sin tocar lo anterior", async () => {
    await R.guardarReglas("ws-1", "prod-1", [regla({ title: "Previa" })]);
    expect(await R.guardarReglas("ws-1", "prod-1", [regla({ ownerUserId: 99 })])).toMatchObject({ ok: false, error: expect.stringContaining("responsables") });
    expect(filas().map((f) => f.title)).toEqual(["Previa"]);
    expect(await R.guardarReglas("ws-1", "prod-ajeno", [regla()])).toMatchObject({ ok: false });
    expect(await R.leerReglas("ws-1", "prod-ajeno")).toEqual([]);
  });

  it("las opciones traen sólo los tipos activos del workspace", async () => {
    const o = await R.opcionesDeRegla("ws-1");
    expect(o.tipos.map((t) => t.id)).toEqual(["t-1"]);
  });
});

describe("la acción del catálogo exige sales.catalog", () => {
  it("guardarReglasCitaAction pide requireSalesAdmin antes de escribir", () => {
    const fuente = readFileSync(join(__dirname, "../../app/(shell)/ventas/catalogo/[productId]/presupuesto-actions.ts"), "utf8");
    const i = fuente.indexOf("export async function guardarReglasCitaAction");
    expect(i).toBeGreaterThan(0);
    const cuerpo = fuente.slice(i);
    expect(cuerpo.indexOf("requireSalesAdmin()")).toBeGreaterThan(0);
    expect(cuerpo.indexOf("requireSalesAdmin()")).toBeLessThan(cuerpo.indexOf("guardarReglasCita("));
  });
});
