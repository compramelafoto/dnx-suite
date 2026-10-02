import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(), modulo: vi.fn(), revalidate: vi.fn(), registro: vi.fn(), guardar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/campos/acceso", () => ({ contextoDeCampos: H.ctx }));
vi.mock("@/lib/campos/valores", () => ({
  MENSAJES_VALORES: { sinPermiso: "No tenés permiso para hacer esto.", noEncontrado: "No encontramos ese registro." },
  registroDelWorkspace: H.registro,
  guardarValores: H.guardar,
}));

const A = await import("./campos");

const CTX = { workspaceId: "ws-1", workspaceSlug: "", userId: 7, userLabel: "Ana", role: "STAFF" };
const INVALIDOS = { ok: false, error: "Los datos no son válidos." };
const SIN_ACCESO = { ok: false, error: "No tenés permiso para hacer esto." };
const BIEN = { entityType: "CLIENTE", entityId: "c1", valores: { f1: "hola", f2: null, f3: 12 } };

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  H.modulo.mockResolvedValue(true);
  H.registro.mockResolvedValue(true);
  H.guardar.mockResolvedValue({ ok: true });
});

describe("guardarValoresAction", () => {
  it("guarda con el workspace de la sesión y revalida la ficha", async () => {
    expect(await A.guardarValoresAction(BIEN)).toEqual({ ok: true });
    expect(H.registro).toHaveBeenCalledWith("ws-1", "CLIENTE", "c1");
    expect(H.guardar).toHaveBeenCalledWith(CTX, "CLIENTE", "c1", BIEN.valores);
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
  });

  it.each([
    ["SOCIO", "members", "/members/m1"],
    ["CONSULTA", "service-leads", "/captacion/m1"],
  ])("%s mira el módulo %s y revalida %s", async (entityType, modulo, ruta) => {
    await A.guardarValoresAction({ ...BIEN, entityType, entityId: "m1" });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", modulo);
    expect(H.revalidate).toHaveBeenCalledWith(ruta);
  });

  it.each([
    ["sin datos", null],
    ["tipo reservado", { ...BIEN, entityType: "PRESUPUESTO" }],
    ["tipo inventado", { ...BIEN, entityType: "X" }],
    ["id vacío", { ...BIEN, entityId: "" }],
    ["id largo", { ...BIEN, entityId: "x".repeat(101) }],
    ["valores no objeto", { ...BIEN, valores: ["a"] }],
    ["valor objeto", { ...BIEN, valores: { f1: { a: 1 } } }],
    ["valor booleano", { ...BIEN, valores: { f1: true } }],
    ["número infinito", { ...BIEN, valores: { f1: Infinity } }],
    ["texto enorme", { ...BIEN, valores: { f1: "x".repeat(5000) } }],
    ["demasiadas claves", { ...BIEN, valores: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`f${i}`, "a"])) }],
  ])("forma inválida (%s): ni siquiera arma el contexto", async (_n, datos) => {
    expect(await A.guardarValoresAction(datos as never)).toEqual(INVALIDOS);
    expect(H.ctx).not.toHaveBeenCalled();
    expect(H.guardar).not.toHaveBeenCalled();
  });

  it("sin contexto no guarda", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await A.guardarValoresAction(BIEN)).toEqual(SIN_ACCESO);
    expect(H.guardar).not.toHaveBeenCalled();
  });

  it("módulo apagado no guarda ni busca el registro", async () => {
    H.modulo.mockResolvedValue(false);
    expect(await A.guardarValoresAction(BIEN)).toEqual({ ok: false, error: "Ese módulo no está activo." });
    expect(H.registro).not.toHaveBeenCalled();
    expect(H.guardar).not.toHaveBeenCalled();
  });

  it("sin `operar` no guarda", async () => {
    H.ctx.mockResolvedValue({ ...CTX, role: "COLLABORATOR" });
    expect(await A.guardarValoresAction(BIEN)).toEqual(SIN_ACCESO);
    expect(H.guardar).not.toHaveBeenCalled();
  });

  it("registro de otro workspace → no encontrado", async () => {
    H.registro.mockResolvedValue(false);
    expect(await A.guardarValoresAction(BIEN)).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(H.guardar).not.toHaveBeenCalled();
  });

  it("con errores por campo los devuelve y no revalida", async () => {
    const r = { ok: false, error: "Revisá los campos marcados.", errores: { f1: "Este campo es obligatorio." } };
    H.guardar.mockResolvedValue(r);
    expect(await A.guardarValoresAction(BIEN)).toEqual(r);
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});

describe("fuente", () => {
  it("archivo use server que sólo exporta funciones async", () => {
    const fuente = readFileSync(new URL("./campos.ts", import.meta.url), "utf8");
    expect(fuente.startsWith('"use server";')).toBe(true);
    const exportados = fuente.match(/^export .*/gm) ?? [];
    expect(exportados.length).toBeGreaterThan(0);
    for (const e of exportados) expect(e).toMatch(/^export async function /);
  });
});
