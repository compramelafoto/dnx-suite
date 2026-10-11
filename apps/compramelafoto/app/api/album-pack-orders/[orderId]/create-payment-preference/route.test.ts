import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const createPreference = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (...args: unknown[]) => findUnique(...args), update: vi.fn() },
    album: { findUnique: vi.fn() },
    albumPackOrderDraft: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn(async () => null) }));
vi.mock("@/lib/mercadopago", () => ({
  createPreference: (...args: unknown[]) => createPreference(...args),
}));
vi.mock("@/lib/album-packs/album-pack-feature-flags", () => ({
  isAlbumPackPaymentGloballyAllowedForAlbum: () => true,
}));
vi.mock("@/lib/album-packs/resolve-album-pack-order-mp-component", () => ({
  albumPackMpShadowCompareSite: vi.fn(),
  resolveAlbumPackOrderMpContext: vi.fn(),
}));
vi.mock("@/lib/pricing/client-price", () => ({ resolveClientMarketplaceFeePercent: vi.fn() }));
vi.mock("@/lib/services/commissionService", () => ({ resolvePlatformCommissionPercent: vi.fn() }));
vi.mock("@/lib/pricing/checkout-fee-shadow", () => ({ scheduleCheckoutFeeShadowCompare: vi.fn() }));
vi.mock("@/lib/referral/referral-marketplace-fee", () => ({
  applyAndPersistSellerReferralDiscount: vi.fn(),
}));
vi.mock("@/lib/event-organizer-commission-mp-checkout", () => ({
  buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer: vi.fn(),
}));
vi.mock("@/lib/mercadopago/resolve-album-order-mp-credentials", () => ({
  resolveAlbumOrderMercadoPagoCredentials: vi.fn(),
}));
vi.mock("@/lib/mercadopago/mp-oauth-token-refresh", () => ({
  buildMercadoPagoUnauthorizedRefresher: vi.fn(),
}));

import { POST } from "./route";

function baseOrder(overrides: Record<string, unknown>) {
  return {
    id: 4645,
    albumId: 1,
    buyerEmail: "juan@example.com",
    status: "PENDING",
    origin: "STANDARD_CHECKOUT",
    checkoutPaymentSource: "MERCADO_PAGO",
    totalCents: 15000,
    extensionSurchargeCents: 0,
    pricingSnapshot: {},
    preCompraPaymentRef: "ALBUM_PACK_DRAFT:draft-1",
    mpInitPoint: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=abc",
    mpPreferenceId: "abc",
    items: [],
    ...overrides,
  };
}

async function callRoute() {
  const req = {
    headers: new Headers(),
    nextUrl: new URL("https://compramelafoto.com/api/album-pack-orders/4645/create-payment-preference"),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await POST(req as any, { params: Promise.resolve({ orderId: "4645" }) });
  return { status: res.status, body: await res.json() };
}

describe("POST /api/album-pack-orders/[orderId]/create-payment-preference", () => {
  beforeEach(() => {
    findUnique.mockReset();
    createPreference.mockReset();
  });

  it("pedido PAID con link guardado: 409 ORDER_ALREADY_PAID y sin link (caso 4645)", async () => {
    findUnique.mockResolvedValue(baseOrder({ status: "PAID" }));
    const { status, body } = await callRoute();
    expect(status).toBe(409);
    expect(body.code).toBe("ORDER_ALREADY_PAID");
    expect(body.initPoint).toBeUndefined();
    expect(createPreference).not.toHaveBeenCalled();
  });

  it("pedido REFUNDED: tampoco devuelve el link", async () => {
    findUnique.mockResolvedValue(baseOrder({ status: "REFUNDED" }));
    const { status, body } = await callRoute();
    expect(status).toBe(409);
    expect(body.code).toBe("ORDER_NOT_PAYABLE");
    expect(body.initPoint).toBeUndefined();
  });

  it("pedido PENDING con link guardado: lo reusa como antes", async () => {
    findUnique.mockResolvedValue(baseOrder({ status: "PENDING" }));
    const { status, body } = await callRoute();
    expect(status).toBe(200);
    expect(body.reused).toBe(true);
    expect(body.initPoint).toContain("pref_id=abc");
  });
});
