import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ modulo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/vocabulario/load", () => ({ loadPersonVocabulary: vi.fn() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));

const { proveedoresParaWorkspace, PROVEEDORES_FICHA } = await import("./index");

function conModulos(encendidos: string[]) {
  H.modulo.mockImplementation(async (_ws: string, clave: string) => encendidos.includes(clave));
}

async function claves(ws = "ws-1") {
  return (await proveedoresParaWorkspace(ws)).map((p) => p.clave);
}

beforeEach(() => H.modulo.mockReset());

describe("proveedoresParaWorkspace — las fuentes siguen a los módulos encendidos", () => {
  it("con caja y socios encendidos: todas las fuentes", async () => {
    conModulos(["cash", "members"]);
    expect(await claves()).toEqual(PROVEEDORES_FICHA.map((p) => p.clave));
  });

  it("sin caja: no lee movimientos de caja", async () => {
    conModulos(["members"]);
    const c = await claves();
    expect(c).not.toContain("caja");
    expect(c).toContain("cuotas");
    expect(c).toContain("carnets");
  });

  it("sin socios: no lee cuotas ni carnets", async () => {
    conModulos(["cash"]);
    const c = await claves();
    expect(c).toContain("caja");
    expect(c).not.toContain("cuotas");
    expect(c).not.toContain("carnets");
  });

  it("sin ninguno: quedan las fuentes que no dependen de módulo", async () => {
    conModulos([]);
    expect(await claves()).toEqual(["notas", "eventos-persona", "historial-cliente", "historial-socio", "campos", "mensajes", "adjuntos"]);
  });

  it("pregunta por el workspace recibido, una vez por módulo", async () => {
    conModulos([]);
    await claves("ws-9");
    expect(H.modulo.mock.calls.map((c) => c[0])).toEqual(["ws-9", "ws-9"]);
    expect(H.modulo.mock.calls.map((c) => c[1]).sort()).toEqual(["cash", "members"]);
  });
});
