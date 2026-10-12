import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ order: vi.fn(), token: vi.fn(), create: vi.fn(), resend: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findFirst: (...a: unknown[]) => m.order(...a) },
    orderDownloadToken: { findFirst: (...a: unknown[]) => m.token(...a) },
  },
}));
vi.mock("@/lib/download-tokens", () => ({ createClientDownloadToken: (...a: unknown[]) => m.create(...a) }));
vi.mock("@/lib/zip-job-notifications", () => ({
  resendDigitalDownloadEmailForOrder: (...a: unknown[]) => m.resend(...a),
}));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: async () => ({ downloadLinkDays: 15 }) }));
import { pedidosTools } from "./pedidos";

const actor = { userId: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" };
const t = pedidosTools.find((x) => x.name === "reenviar_link_de_descarga")!;
const paid = { id: 5, status: "PAID", albumId: 3, buyerEmail: "comprador@gmail.com" };
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
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
});
