import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  revalidate: vi.fn(),
  guardar: vi.fn(),
  previsualizar: vi.fn(),
  importar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/contactos/acceso", () => ({ contextoDeContactos: H.ctx }));
vi.mock("@/lib/contactos/perfil", () => ({
  guardarPerfil: H.guardar,
  MENSAJES_PERFIL: { sinPermiso: "No tenés permiso para hacer esto.", revisar: "Revisá los campos marcados." },
}));
vi.mock("@/lib/clients/importar", () => ({
  previsualizarImportacionClientes: H.previsualizar,
  importarClientes: H.importar,
  MENSAJES_IMPORTACION: { sinPermiso: "No tenés permiso para hacer esto." },
}));

const P = await import("./contactos");
const I = await import("./clientes-import");

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const SIN_ACCESO = { ok: false, error: "No tenés permiso para hacer esto." };

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  H.guardar.mockResolvedValue({ ok: true });
  H.previsualizar.mockResolvedValue({ ok: true, filas: [], validas: 0, conError: 0, duplicadas: 0 });
  H.importar.mockResolvedValue({ ok: true, creados: 2, conError: 0, duplicadas: 0, fallidas: 0 });
});

const LLAMADAS: [string, () => Promise<unknown>][] = [
  ["perfil", () => P.guardarPerfilContactoAction({ clientId: "c1", datos: { category: "PROVEEDOR" } })],
  ["vista previa", () => I.previsualizarImportacionClientesAction("nombre\nAna")],
  ["importar", () => I.importarClientesAction("nombre\nAna")],
];

describe("acciones de contactos (Clientes)", () => {
  it.each(LLAMADAS)("%s: pide «Gestionar» (operar) en Clientes", async (_n, llamar) => {
    await llamar();
    expect(H.ctx).toHaveBeenCalledWith("operar");
  });

  it.each(LLAMADAS)("%s: sin contexto (sin sesión, módulo apagado, sólo «Ver») no lee ni escribe", async (_n, llamar) => {
    H.ctx.mockResolvedValue(null);
    expect(await llamar()).toEqual(SIN_ACCESO);
    for (const f of [H.guardar, H.previsualizar, H.importar]) expect(f).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("el workspace sale de la sesión, nunca del pedido", async () => {
    await P.guardarPerfilContactoAction({ clientId: "c1", datos: { mobile: "341" }, workspaceId: "ws-2" } as never);
    expect(H.guardar).toHaveBeenCalledWith(CTX, "c1", { mobile: "341" });
    await I.importarClientesAction("x");
    expect(H.importar).toHaveBeenCalledWith(CTX, "x");
  });

  it("perfil: revalida la ficha sólo si guardó; un pedido sin datos no llega a la base", async () => {
    await P.guardarPerfilContactoAction({ clientId: "c1", datos: {} });
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
    vi.clearAllMocks();
    H.ctx.mockResolvedValue(CTX);
    H.guardar.mockResolvedValue({ ok: false, error: "x" });
    await P.guardarPerfilContactoAction({ clientId: "c1", datos: {} });
    expect(H.revalidate).not.toHaveBeenCalled();
    expect(await P.guardarPerfilContactoAction({ clientId: "c1" } as never)).toEqual({ ok: false, error: "Revisá los campos marcados." });
  });

  it("importar: revalida la lista cuando creó algo", async () => {
    await I.importarClientesAction("x");
    expect(H.revalidate).toHaveBeenCalledWith("/clientes");
  });
});
