import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  order: vi.fn(), token: vi.fn(), create: vi.fn(), resend: vi.fn(), fotos: vi.fn(), videos: vi.fn(), pack: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findFirst: (...a: unknown[]) => m.order(...a) },
    orderDownloadToken: { findFirst: (...a: unknown[]) => m.token(...a) },
    orderItem: { count: (...a: unknown[]) => m.fotos(...a) },
    videoOrderItem: { count: (...a: unknown[]) => m.videos(...a) },
  },
}));
vi.mock("@/lib/preventa-canjeable/recuperar-pack", () => ({ recuperarLinksDePack: (...a: unknown[]) => m.pack(...a) }));
vi.mock("@/lib/download-tokens", () => ({ createClientDownloadToken: (...a: unknown[]) => m.create(...a) }));
vi.mock("@/lib/zip-job-notifications", () => ({
  resendDigitalDownloadEmailForOrder: (...a: unknown[]) => m.resend(...a),
}));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: async () => ({ downloadLinkDays: 15 }) }));
import { pedidosTools } from "./pedidos";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const t = pedidosTools.find((x) => x.name === "reenviar_link_de_descarga")!;
const paid = { id: 5, status: "PAID", albumId: 3, buyerEmail: "comprador@gmail.com", origin: "ALBUM", redemptionOrderId: null };
const packSinCanjear = { ...paid, id: 4673, origin: "PREVENTA_PACK", buyerEmail: "familia@gmail.com" };
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.fotos.mockResolvedValue(1);
  m.videos.mockResolvedValue(0);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reenviar_link_de_descarga", () => {
  it("pedido ajeno → no encontrado", async () => {
    m.order.mockResolvedValue(null);
    expect(await t.run({ orderId: 5 }, actor)).toMatchObject({ ok: false });
    expect(m.order.mock.calls[0]![0].where).toMatchObject({ id: 5, album: { userId: 7 }, isTest: false });
    expect(m.resend).not.toHaveBeenCalled();
  });
  it("describe de un pedido ajeno o inexistente lanza (sin tarjeta)", async () => {
    m.order.mockResolvedValue(null);
    await expect(t.describe!({ orderId: 5 }, actor)).rejects.toThrow("No encontré el pedido #5 en tu cuenta.");
    m.order.mockResolvedValue(paid);
    expect(await t.describe!({ orderId: 5 }, actor)).toContain("co***@gmail.com");
  });
  it("pedido no pagado → no reenvía", async () => {
    m.order.mockResolvedValue({ ...paid, status: "PENDING" });
    expect(await t.run({ orderId: 5 }, actor)).toMatchObject({ ok: false });
    expect(m.resend).not.toHaveBeenCalled();
  });
  it("sin link vigente → crea uno y reenvía, con el mail enmascarado", async () => {
    m.order.mockResolvedValue(paid);
    m.token.mockResolvedValue(null);
    m.resend.mockResolvedValue({ queued: true });
    const r = (await t.run({ orderId: 5 }, actor)) as { ok: boolean; message: string };
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ orderId: 5, albumId: 3 }));
    expect(r.ok).toBe(true);
    expect(r.message).toContain("co***@gmail.com");
    expect(r.message).not.toContain("comprador@");
    expect(m.resend.mock.calls[0]![1].idempotencyKey).toMatch(/^dnx-bot-resend-5-\d{4}-\d\d-\d\dT\d\d$/);
  });
  it("con link vigente → no crea otro", async () => {
    m.order.mockResolvedValue(paid);
    m.token.mockResolvedValue({ id: 1 });
    m.resend.mockResolvedValue({ queued: true });
    expect(await t.run({ orderId: 5 }, actor)).toMatchObject({ ok: true });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("falla del envío → mensaje amable sin el error crudo", async () => {
    m.order.mockResolvedValue(paid);
    m.token.mockResolvedValue({ id: 1 });
    m.resend.mockResolvedValue({ queued: false, error: "Sin token de descarga" });
    const r = (await t.run({ orderId: 5 }, actor)) as { ok: boolean; message: string };
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("token");
  });

  it("pack de preventa sin canjear → reenvía el link del canje, no una descarga vacía", async () => {
    m.order.mockResolvedValue(packSinCanjear);
    m.pack.mockResolvedValue({ enviados: 1 });
    expect(await t.describe!({ orderId: 4673 }, actor)).toContain("canjear el pack #4673");
    const r = (await t.run({ orderId: 4673 }, actor)) as { ok: boolean; message: string };
    expect(r.ok).toBe(true);
    expect(m.pack).toHaveBeenCalledWith("familia@gmail.com", { soloPedidoId: 4673 });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.resend).not.toHaveBeenCalled();
    expect(r.message).toContain("todavía no se canjeó");
    expect(r.message).not.toContain("familia@");
  });
  it("pack sin canjear con mail de relleno → no manda nada y avisa", async () => {
    m.order.mockResolvedValue({ ...packSinCanjear, buyerEmail: "sin-email@canje-externo.invalid" });
    expect(await t.run({ orderId: 4673 }, actor)).toMatchObject({ ok: false, code: "PACK_SIN_MAIL" });
    expect(m.pack).not.toHaveBeenCalled();
  });
  it("pack ya canjeado → reenvía la descarga del pedido del canje", async () => {
    m.order.mockResolvedValue({ ...packSinCanjear, redemptionOrderId: 5136 });
    m.token.mockResolvedValue({ id: 1 });
    m.resend.mockResolvedValue({ queued: true });
    const r = (await t.run({ orderId: 4673 }, actor)) as { ok: boolean; message: string };
    expect(r.ok).toBe(true);
    expect(m.resend.mock.calls[0]![0]).toBe(5136);
    expect(r.message).toContain("#5136");
    expect(m.pack).not.toHaveBeenCalled();
  });
  it("pedido sin fotos digitales ni videos → no crea link", async () => {
    m.order.mockResolvedValue(paid);
    m.fotos.mockResolvedValue(0);
    expect(await t.run({ orderId: 5 }, actor)).toMatchObject({ ok: false, code: "SIN_FOTOS_DIGITALES" });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.resend).not.toHaveBeenCalled();
  });
});
