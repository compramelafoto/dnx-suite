import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindUnique = vi.fn();
const orderFindFirst = vi.fn();
const userFindUnique = vi.fn();
const getPaymentById = vi.fn();
const queueEmail = vi.fn();
const registerAuditEvent = vi.fn();
const queueOrderConfirmationEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: (...a: unknown[]) => orderFindUnique(...a),
      findFirst: (...a: unknown[]) => orderFindFirst(...a),
      update: vi.fn(),
    },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    printOrder: { updateMany: vi.fn(async () => ({ count: 0 })), findFirst: vi.fn(async () => null) },
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
  queueOrderConfirmationEmail: (...a: unknown[]) => queueOrderConfirmationEmail(...a),
  queuePhotographerOrderNotification: vi.fn(async () => undefined),
  queuePhotographerPrintOrderNotification: vi.fn(async () => undefined),
  queuePreventaPackAccessEmail: vi.fn(),
}));
vi.mock("@/lib/whatsapp/sendOrderDelivery", () => ({ deliverOrderByWhatsApp: vi.fn(async () => undefined) }));
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
vi.mock("@/lib/order-fulfillment", () => ({
  getAlbumOrderFulfillmentFromItems: vi.fn(() => ({ hasDigitalItems: false, hasPrintItems: true })),
}));
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

import { runAlbumOrderPaidSideEffects } from "./finalize-album-order-mp-approved";

describe("runAlbumOrderPaidSideEffects — comprobante al comprador", () => {
  beforeEach(() => {
    queueOrderConfirmationEmail.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("no termina hasta que el comprobante quedó en la cola (pedido 3791)", async () => {
    let encolado = false;
    queueOrderConfirmationEmail.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      encolado = true;
    });

    await runAlbumOrderPaidSideEffects({
      orderId: 3791,
      origin: "STANDARD_CHECKOUT" as never,
      items: [{ productType: "PRINT" }],
      paymentRef: "181188819329",
    });

    expect(queueOrderConfirmationEmail).toHaveBeenCalledWith(3791);
    expect(encolado).toBe(true);
  });

  it("si encolar falla, lo registra y sigue con el resto de los avisos", async () => {
    queueOrderConfirmationEmail.mockRejectedValue(new Error("db caída"));

    await expect(
      runAlbumOrderPaidSideEffects({
        orderId: 1,
        origin: "STANDARD_CHECKOUT" as never,
        items: [{ productType: "PRINT" }],
        paymentRef: null,
      })
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      "Error encolando email de confirmación de pedido:",
      expect.any(Error)
    );
  });

  it("preventa sin fotos: no manda comprobante (recibe el acceso al pack)", async () => {
    await runAlbumOrderPaidSideEffects({
      orderId: 2,
      origin: "PREVENTA_PACK" as never,
      items: [],
      paymentRef: null,
    });
    expect(queueOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});
