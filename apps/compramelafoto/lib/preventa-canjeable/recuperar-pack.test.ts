import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ find: vi.fn(), token: vi.fn(), mail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { order: { findMany: (...a: unknown[]) => m.find(...a) } },
  OrderOrigin: { PREVENTA_PACK: "PREVENTA_PACK" },
  OrderStatus: { PAID: "PAID" },
}));
vi.mock("@/lib/preventa-canjeable/pack-access-tokens", () => ({
  createPackAccessTokenForOrder: (...a: unknown[]) => m.token(...a),
}));
vi.mock("@/lib/order-confirmation-email", () => ({
  queuePreventaPackRecoveryEmail: (...a: unknown[]) => m.mail(...a),
}));
import { RESPUESTA_RECUPERAR_PACK, recuperarLinksDePack } from "./recuperar-pack";

beforeEach(() => {
  m.find.mockReset();
  m.token.mockReset();
  m.mail.mockReset();
});

describe("recuperarLinksDePack", () => {
  it("texto genérico de la ruta", () => {
    expect(RESPUESTA_RECUPERAR_PACK).toBe("Si encontramos pedidos con ese email, te enviamos un link.");
  });
  it("mail inválido → 0 sin consultar", async () => {
    expect(await recuperarLinksDePack("nada")).toEqual({ enviados: 0 });
    expect(m.find).not.toHaveBeenCalled();
  });
  it("sin soloPedidoId el where no filtra por id", async () => {
    m.find.mockResolvedValue([]);
    expect(await recuperarLinksDePack(" A@B.com ")).toEqual({ enviados: 0 });
    const where = m.find.mock.calls[0]![0].where;
    expect(where).toEqual({
      origin: "PREVENTA_PACK",
      status: "PAID",
      // El pack de prueba del fotógrafo no se manda a nadie.
      isTest: false,
      buyerEmail: { equals: "a@b.com", mode: "insensitive" },
    });
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("con soloPedidoId agrega el id al where", async () => {
    m.find.mockResolvedValue([]);
    await recuperarLinksDePack("a@b.com", { soloPedidoId: 9 });
    expect(m.find.mock.calls[0]![0].where).toMatchObject({ id: 9, status: "PAID" });
  });
  it("devuelve cuántos packs mandó (salta los que no dieron token)", async () => {
    m.find.mockResolvedValue([
      { id: 5, album: { title: "A" } },
      { id: 6, album: null },
      { id: 7, album: { title: "C" } },
    ]);
    m.token.mockImplementation(async (id: number) => (id === 7 ? null : { token: `t${id}` }));
    expect(await recuperarLinksDePack("a@b.com")).toEqual({ enviados: 2 });
    expect(m.mail).toHaveBeenCalledTimes(1);
    const packs = m.mail.mock.calls[0]![0].packs;
    expect(packs.map((p: { orderId: number }) => p.orderId)).toEqual([5, 6]);
    expect(packs[1].albumTitle).toBeNull();
  });
});
