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
import { POST } from "./route";

const req = (body: unknown) =>
  new Request("http://x/api/public/pack/recover", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  m.find.mockReset();
  m.token.mockReset();
  m.mail.mockReset();
});

describe("POST /api/public/pack/recover", () => {
  it("mail inválido → respuesta genérica sin consultar", async () => {
    const r = await POST(req({ email: "nada" }));
    expect(await r.json()).toEqual({ ok: true, message: "Si encontramos pedidos con ese email, te enviamos un link." });
    expect(m.find).not.toHaveBeenCalled();
  });
  it("sin pedidos → misma respuesta y sin mail", async () => {
    m.find.mockResolvedValue([]);
    const r = await POST(req({ email: "a@b.com" }));
    expect((await r.json()).message).toBe("Si encontramos pedidos con ese email, te enviamos un link.");
    expect(m.mail).not.toHaveBeenCalled();
  });
  it("con pedidos → token nuevo revocando el anterior y un mail con los packs", async () => {
    m.find.mockResolvedValue([{ id: 5, album: { title: "Egresados" } }]);
    m.token.mockResolvedValue({ token: "tok" });
    await POST(req({ email: "A@B.com" }));
    expect(m.token).toHaveBeenCalledWith(5, { revokeExisting: true });
    expect(m.mail).toHaveBeenCalledWith({
      email: "a@b.com",
      packs: [
        expect.objectContaining({
          orderId: 5,
          albumTitle: "Egresados",
          packAccessUrl: expect.stringContaining("/cliente/pack/tok"),
        }),
      ],
    });
  });
});
