import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ ctx: vi.fn(), modulo: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: async () => ({ plural: "socios" }) }));
vi.mock("./acceso", () => ({ contextoDeCampos: H.ctx }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));

const F = await import("./ficha");

const CTX = { workspaceId: "ws-1", workspaceSlug: "otro", userId: 7, userLabel: "Ana", role: "STAFF" };

beforeEach(() => {
  B.vaciar();
  H.ctx.mockReset().mockResolvedValue(CTX);
  H.modulo.mockReset().mockResolvedValue(true);
  B.agregar("client", { id: "c1", workspaceId: "ws-1" });
  B.agregar("client", { id: "cx", workspaceId: "ws-2" });
  B.agregar("member", { id: "m1", workspaceId: "ws-1" });
  B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1" });
  const f = (id: string, extra: Record<string, unknown>) =>
    B.agregar("fotofficeCustomField", { id, workspaceId: "ws-1", entityType: "CLIENTE", key: id, name: id, ...extra });
  f("fecha", { name: "Boda", type: "FECHA", order: 0 });
  f("vip", { name: "VIP", type: "SI_NO", order: 1 });
  f("web", { name: "Web", type: "ENLACE", order: 2 });
  f("dni", { name: "DNI", type: "TEXTO", order: 3, required: true });
  f("estilo", { name: "Estilo", type: "LISTA", order: 4 });
  f("viejo", { name: "Viejo", type: "TEXTO", order: 5, archivedAt: new Date() });
  B.agregar("fotofficeCustomFieldOption", { id: "o1", fieldId: "estilo", label: "Clásico", order: 0 });
  B.agregar("fotofficeCustomFieldOption", { id: "o2", fieldId: "estilo", label: "Retro", order: 1, archivedAt: new Date() });
  const v = (fieldId: string, extra: Record<string, unknown>) =>
    B.agregar("fotofficeCustomValue", { workspaceId: "ws-1", fieldId, entityType: "CLIENTE", entityId: "c1", ...extra });
  v("fecha", { valueDate: new Date("2026-11-20T00:00:00.000Z") });
  v("vip", { valueBool: true });
  v("web", { valueText: "https://drive.example.com/x" });
  v("estilo", { optionId: "o2" });
  v("viejo", { valueText: "no se ve" });
});

describe("contextoDeMasDatos — la guarda antes de leer", () => {
  it("sin sesión/rol, con el módulo apagado o con un registro ajeno: null, sin leer valores", async () => {
    const leer = vi.spyOn(B.tablas.fotofficeCustomValue as { findMany: () => unknown }, "findMany");
    H.ctx.mockResolvedValueOnce(null);
    expect(await F.cargarMasDatos("CLIENTE", "c1")).toBeNull();
    H.modulo.mockResolvedValueOnce(false);
    expect(await F.cargarMasDatos("CLIENTE", "c1")).toBeNull();
    expect(await F.cargarMasDatos("CLIENTE", "cx")).toBeNull();
    expect(await F.cargarMasDatos("SOCIO", "c1")).toBeNull();
    expect(leer).not.toHaveBeenCalled();
    leer.mockRestore();
  });

  it("tipo inválido o id raro: null sin consultar la sesión", async () => {
    expect(await F.contextoDeMasDatos("PRESUPUESTO", "c1")).toBeNull();
    expect(await F.contextoDeMasDatos("CLIENTE", "")).toBeNull();
    expect(await F.contextoDeMasDatos("CLIENTE", "x".repeat(101))).toBeNull();
    expect(H.ctx).not.toHaveBeenCalled();
  });

  it("pregunta por el módulo del tipo en el workspace de la sesión", async () => {
    await F.contextoDeMasDatos("SOCIO", "m1");
    await F.contextoDeMasDatos("CONSULTA", "l1");
    expect(H.modulo.mock.calls).toEqual([
      ["ws-1", "members"],
      ["ws-1", "service-leads"],
    ]);
  });
});

describe("cargarMasDatos", () => {
  it("los activos en orden con sus valores legibles; archivados afuera; obligatorio vacío", async () => {
    const v = await F.cargarMasDatos("CLIENTE", "c1");
    expect(v?.puedeEditar).toBe(true);
    expect(v?.puedeConfigurar).toBe(false);
    expect(v?.campos.map((c) => [c.nombre, c.legible, c.crudo])).toEqual([
      ["Boda", "20/11/2026", "2026-11-20"],
      ["VIP", "Sí", "si"],
      ["Web", "https://drive.example.com/x", "https://drive.example.com/x"],
      ["DNI", "", ""],
      ["Estilo", "Retro", "o2"],
    ]);
    expect(v?.campos.find((c) => c.nombre === "Web")?.href).toBe("https://drive.example.com/x");
    expect(v?.campos.find((c) => c.nombre === "DNI")?.obligatorio).toBe(true);
    // La opción archivada que ya es el valor se sigue pudiendo dejar.
    expect(v?.campos.find((c) => c.nombre === "Estilo")?.opciones).toEqual([
      { id: "o1", label: "Clásico" },
      { id: "o2", label: "Retro (archivada)" },
    ]);
    expect(JSON.stringify(v)).not.toContain("no se ve");
  });

  it("en un cliente de DNX crea «Archivos del cliente» si no hay campos", async () => {
    B.datos.fotofficeCustomField = [];
    H.ctx.mockResolvedValue({ ...CTX, workspaceSlug: "dnx-estudio", role: "WORKSPACE_OWNER" });
    const v = await F.cargarMasDatos("CLIENTE", "c1");
    expect(v?.campos.map((c) => [c.nombre, c.tipo])).toEqual([["Archivos del cliente", "ENLACE"]]);
    expect(v?.puedeConfigurar).toBe(true);
    await F.cargarMasDatos("CLIENTE", "c1");
    expect(B.datos.fotofficeCustomField).toHaveLength(1);
  });

  it("en DNX con campos de clientes ya creados: un conteo, sin abrir transacción", async () => {
    H.ctx.mockResolvedValue({ ...CTX, workspaceSlug: "dnx-estudio" });
    await F.cargarMasDatos("CLIENTE", "c1");
    expect(B.transacciones).toHaveLength(0);
    expect(B.datos.fotofficeCustomField.filter((f) => f.name === "Archivos del cliente")).toHaveLength(0);
  });

  it("sin campos activos: lista vacía", async () => {
    expect((await F.cargarMasDatos("SOCIO", "m1"))?.campos).toEqual([]);
  });
});

describe("cambiosDeConsulta", () => {
  it("sólo los de esa consulta en ese workspace, legibles", async () => {
    B.agregar("fotofficeCustomField", { id: "fc", workspaceId: "ws-1", entityType: "CONSULTA", key: "p", name: "Presupuesto", type: "NUMERO" });
    const c = (id: string, extra: Record<string, unknown>) =>
      B.agregar("fotofficeCustomValueChange", { id, workspaceId: "ws-1", entityType: "CONSULTA", entityId: "l1", fieldId: "fc", ...extra });
    c("x1", { before: null, after: "1500", actorLabel: "Ana", createdAt: new Date("2026-10-01T15:00:00Z") });
    c("x2", { workspaceId: "ws-2" });
    c("x3", { entityId: "l2" });
    c("x4", { entityType: "CLIENTE" });
    expect(await F.cambiosDeConsulta("ws-1", "l1")).toEqual([
      { id: "x1", fecha: "2026-10-01T15:00:00.000Z", quien: "Ana", campo: "Presupuesto", antes: "vacío", despues: "1500" },
    ]);
  });
});
