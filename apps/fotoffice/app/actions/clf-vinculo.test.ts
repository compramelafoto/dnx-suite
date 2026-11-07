import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ ped: vi.fn(), pro: vi.fn(), vincular: vi.fn(), quitar: vi.fn(), revalidate: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/pedidos/contexto", () => ({ contextoDePedidos: H.ped }));
vi.mock("@/lib/proyectos/contexto", () => ({ contextoDeProyectos: H.pro }));
vi.mock("@/lib/clf/vinculo", () => ({ vincularAlbum: H.vincular, quitarVinculo: H.quitar }));

const A = await import("./clf-vinculo");
const CTX = { workspaceId: "ws-1", userId: 7 };
const SIN_PERMISO = { ok: false, error: "No tenés permiso para hacer esto." };
const INVALIDOS = { ok: false, error: "Los datos no son válidos." };

beforeEach(() => {
  vi.clearAllMocks();
  H.ped.mockResolvedValue(CTX);
  H.pro.mockResolvedValue(CTX);
  H.vincular.mockResolvedValue({ ok: true, vinculo: {} });
  H.quitar.mockResolvedValue({ ok: true });
});

describe("acciones del vínculo con CLF", () => {
  it("pedido: pide Gestionar en Pedidos y usa el workspace de la sesión", async () => {
    await A.vincularAlbumClfAction({ pedidoId: "ped-1" }, "https://www.compramelafoto.com/album/x");
    expect(H.ped).toHaveBeenCalledWith("operar");
    expect(H.vincular).toHaveBeenCalledWith("ws-1", 7, { pedidoId: "ped-1" }, "https://www.compramelafoto.com/album/x");
    expect(H.revalidate).toHaveBeenCalledWith("/pedidos/ped-1");
  });

  it("proyecto: pide Gestionar en Proyectos", async () => {
    await A.quitarVinculoClfAction({ proyectoId: "pro-1" });
    expect(H.pro).toHaveBeenCalledWith("operar");
    expect(H.quitar).toHaveBeenCalledWith("ws-1", { proyectoId: "pro-1" });
  });

  it("sin Gestionar: no escribe", async () => {
    H.ped.mockResolvedValue(null);
    expect(await A.vincularAlbumClfAction({ pedidoId: "ped-1" }, "x")).toEqual(SIN_PERMISO);
    expect(await A.quitarVinculoClfAction({ pedidoId: "ped-1" })).toEqual(SIN_PERMISO);
    expect(H.vincular).not.toHaveBeenCalled();
    expect(H.quitar).not.toHaveBeenCalled();
  });

  it.each([
    [null, "x"],
    [{ pedidoId: "a b" }, "x"],
    [{ pedidoId: "p", proyectoId: "q" }, "x"],
    [{ pedidoId: "p" }, 42],
    [{ pedidoId: "p" }, "x".repeat(2001)],
  ])("forma inválida %#", async (destino, texto) => {
    expect(await A.vincularAlbumClfAction(destino, texto)).toEqual(INVALIDOS);
    expect(H.ped).not.toHaveBeenCalled();
  });
});
