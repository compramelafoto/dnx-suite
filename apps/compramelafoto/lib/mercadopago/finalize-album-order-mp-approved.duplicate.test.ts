import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindUnique = vi.fn();
const orderFindFirst = vi.fn();
const userFindUnique = vi.fn();
const getPaymentById = vi.fn();
const queueEmail = vi.fn();
const registerAuditEvent = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: (...a: unknown[]) => orderFindUnique(...a),
      findFirst: (...a: unknown[]) => orderFindFirst(...a),
      update: vi.fn(),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
  },
}));
vi.mock("@/lib/mercadopago", () => ({
  getPaymentById: (...a: unknown[]) => getPaymentById(...a),
}));
vi.mock("@/lib/email-queue", () => ({ queueEmail: (...a: unknown[]) => queueEmail(...a) }));
vi.mock("@/lib/antifraud/audit", () => ({
  registerAuditEvent: (...a: unknown[]) => registerAuditEvent(...a),
}));
vi.mock("@/lib/pricing/client-price", () => ({
  clientTotalFromPhotographerBaseArs: vi.fn(),
  resolveClientMarketplaceFeePercent: vi.fn(),
}));
vi.mock("@/lib/services/commissionService", () => ({ resolvePlatformCommissionPercent: vi.fn() }));
vi.mock("@/lib/pricing/checkout-fee-shadow", () => ({ scheduleCheckoutFeeShadowCompare: vi.fn() }));
vi.mock("@/lib/digital-delivery", () => ({ ensureDigitalDelivery: vi.fn() }));
vi.mock("@/lib/order-confirmation-email", () => ({
  queueOrderConfirmationEmail: vi.fn(),
  queuePhotographerOrderNotification: vi.fn(),
  queuePhotographerPrintOrderNotification: vi.fn(),
  queuePreventaPackAccessEmail: vi.fn(),
}));
vi.mock("@/lib/whatsapp/sendOrderDelivery", () => ({ deliverOrderByWhatsApp: vi.fn() }));
vi.mock("@/lib/referral/consume-referral-earnings-discount", () => ({
  consumeReferralEarningsForDiscount: vi.fn(),
}));
vi.mock("@/lib/referral/create-referral-earnings-for-paid-sale", () => ({
  createReferralEarningsForPaidSale: vi.fn(),
}));
vi.mock("@/lib/preventa-canjeable/preventa-pack-snapshot-v1", () => ({
  buildPreventaPackSnapshotV1: vi.fn(),
}));
vi.mock("@/lib/preventa-canjeable/pack-access-tokens", () => ({
  createPackAccessTokenForOrder: vi.fn(),
  ensurePackAccessTokenForOrder: vi.fn(),
}));
vi.mock("@/lib/preventa-canjeable/order-checkout-kind", () => ({
  readPackDefinitionIdFromOrderPricingSnapshot: vi.fn(),
  readPackDefinitionIdFromPaymentMetadata: vi.fn(),
}));
vi.mock("@/lib/order-fulfillment", () => ({ getAlbumOrderFulfillmentFromItems: vi.fn() }));
vi.mock("@/lib/school-organizer-commission", () => ({
  createOrganizerCommissionForPaidOrder: vi.fn(),
}));
vi.mock("@/lib/event-organizer-commission-snapshot", () => ({
  ensureEventOrganizerCommissionSnapshotForPaidOrder: vi.fn(async () => undefined),
}));
vi.mock("@/lib/mercadopago/resolve-album-order-mp-credentials", () => ({
  resolveAlbumOrderMpAccessTokenByOrderId: vi.fn(async () => "token-fotografo"),
}));
vi.mock("@/lib/design-v2/album-pack-designs", () => ({ ensureAlbumPackDesignsForPaidOrder: vi.fn() }));

import { finalizeAlbumOrderMercadoPagoApproved } from "./finalize-album-order-mp-approved";

const paidOrder = {
  id: 4645,
  albumId: 77,
  status: "PAID",
  mpPaymentId: "183000000001",
  buyerEmail: "juan@example.com",
  buyerName: "Juan",
  buyerPhone: null,
  album: { userId: 5, eventId: null, isTest: false, selectedLabId: null, title: "Recital" },
  items: [{ productType: "DIGITAL" }],
};

function approvedPayment(id: string, externalReference = "4645") {
  return {
    id,
    status: "approved",
    status_detail: "accredited",
    external_reference: externalReference,
    transaction_amount: 15000,
    currency_id: "ARS",
    date_created: "2026-10-11T21:00:00.000Z",
    date_approved: "2026-10-11T21:00:05.000Z",
  };
}

describe("finalizeAlbumOrderMercadoPagoApproved — cobro duplicado", () => {
  beforeEach(() => {
    orderFindUnique.mockReset().mockResolvedValue(paidOrder);
    orderFindFirst.mockReset().mockResolvedValue(null);
    userFindUnique.mockReset().mockResolvedValue({ name: "Ana", email: "ana@example.com" });
    getPaymentById.mockReset();
    queueEmail.mockReset().mockResolvedValue({ id: 1, queued: true });
    registerAuditEvent.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("otro pago aprobado sobre un pedido PAID: duplicate_payment, log, auditoría y avisos", async () => {
    getPaymentById.mockResolvedValue(approvedPayment("183660994910"));
    const res = await finalizeAlbumOrderMercadoPagoApproved(4645, "183660994910");

    expect(res).toEqual({
      ok: true,
      skipped: "duplicate_payment",
      orderId: 4645,
      paymentId: "183660994910",
      originalPaymentId: "183000000001",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[duplicate-payment]",
      expect.objectContaining({ orderId: 4645, duplicatePaymentId: "183660994910" })
    );
    expect(registerAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PAYMENT_DUPLICATE", targetOrderId: 4645 })
    );
    const recipients = queueEmail.mock.calls.map((c) => (c[0] as { to: string }).to);
    expect(recipients).toContain("ana@example.com");
    expect(recipients.length).toBe(2);
    const keys = queueEmail.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toEqual([
      "duplicate_payment_admin_4645_183660994910",
      "duplicate_payment_photographer_4645_183660994910",
    ]);
  });

  it("reintento del aviso (email ya encolado): no repite la auditoría", async () => {
    getPaymentById.mockResolvedValue(approvedPayment("183660994910"));
    queueEmail.mockResolvedValue({ id: 1, queued: false });
    const res = await finalizeAlbumOrderMercadoPagoApproved(4645, "183660994910");
    expect(res.ok && "skipped" in res && res.skipped).toBe("duplicate_payment");
    expect(registerAuditEvent).not.toHaveBeenCalled();
  });

  it("mismo pago que el registrado: already_paid, sin avisos", async () => {
    const res = await finalizeAlbumOrderMercadoPagoApproved(4645, "183000000001");
    expect(res).toEqual({ ok: true, skipped: "already_paid", orderId: 4645, paymentId: "183000000001" });
    expect(getPaymentById).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
  });

  it("pago que en MP no es de este pedido: no avisa", async () => {
    getPaymentById.mockResolvedValue(approvedPayment("999", "1234"));
    const res = await finalizeAlbumOrderMercadoPagoApproved(4645, "999");
    expect(res.ok && "skipped" in res && res.skipped).toBe("already_paid");
    expect(queueEmail).not.toHaveBeenCalled();
    expect(registerAuditEvent).not.toHaveBeenCalled();
  });

  it("pago ya asignado a otro pedido (resuelto a mano, p. ej. 4646): sin avisos ni auditoría", async () => {
    orderFindFirst.mockResolvedValue({ id: 4646 });
    const res = await finalizeAlbumOrderMercadoPagoApproved(4645, "183660994910");
    expect(res).toEqual({
      ok: true,
      skipped: "payment_assigned_elsewhere",
      orderId: 4645,
      paymentId: "183660994910",
      assignedOrderId: 4646,
    });
    expect(orderFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mpPaymentId: "183660994910", id: { not: 4645 } },
      })
    );
    expect(getPaymentById).not.toHaveBeenCalled();
    expect(queueEmail).not.toHaveBeenCalled();
    expect(registerAuditEvent).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalledWith("[duplicate-payment]", expect.anything());
  });
});
