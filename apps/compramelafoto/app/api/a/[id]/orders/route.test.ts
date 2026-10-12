import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caracterización del checkout de álbum (camino feliz hasta el link de Mercado Pago) y del
 * vínculo con DNX Bot: con o sin la cookie del bot, y aunque guardarla falle, la respuesta es la misma.
 */
const m = vi.hoisted(() => ({
  album: { findUnique: vi.fn() },
  order: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  createPreference: vi.fn(),
  registerAuditEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { album: m.album, order: m.order } }));
vi.mock("@prisma/client", () => ({
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO", PREPAID_PACK: "PREPAID_PACK" },
  OrderOrigin: { STANDARD_CHECKOUT: "STANDARD_CHECKOUT" },
  Prisma: {},
}));
vi.mock("@/lib/videos/video-feature-flag", () => ({ isVideoMvpEnabled: () => false }));
vi.mock("@/lib/videos/create-video-order", () => ({ loadCartVideos: vi.fn() }));
vi.mock("@/lib/videos/video-cart", () => ({ quoteVideoCart: vi.fn() }));
vi.mock("@/lib/pricing/pricing-engine", () => ({
  computeCheckoutTotals: vi.fn(async () => ({
    displayTotalCents: 9000,
    marketplaceFeeCents: 900,
    snapshot: {},
    items: [{ inputIndex: 0, quantity: 1, unitPriceCents: 9000, subtotalCents: 9000, component: "DIGITAL" }],
  })),
}));
vi.mock("@/lib/preventa-canjeable/feature-flag", () => ({ isPreventaPacksV1Enabled: () => false }));
vi.mock("@/lib/preventa-canjeable/pricing-snapshot-v1", () => ({
  buildStandardLinesFromAlbumCheckout: vi.fn(),
  mergeStandardAlbumCheckoutPricingSnapshotV1: vi.fn(),
}));
vi.mock("@/lib/album-helpers", () => ({ isAlbumPubliclyAccessible: () => true }));
vi.mock("@/lib/albums/album-sales-readiness-server", () => ({
  albumSalesNotReadyResponse: vi.fn(),
  isAlbumReadyToSellForCheckout: vi.fn(async () => true),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn(async () => null) }));
vi.mock("@/lib/public-album-test-access", () => ({ denyIfTestAlbumNotOwnerPreview: vi.fn(async () => null) }));
vi.mock("@/lib/event-organizer-commission-mp-checkout", () => ({
  buildAlbumOrderMercadoPagoCheckoutSplit: vi.fn(async () => ({ marketplaceFeePesos: 900 })),
}));
vi.mock("@/lib/mercadopago/resolve-album-order-mp-credentials", () => ({
  resolveAlbumOrderMercadoPagoCredentials: vi.fn(async () => ({
    ok: true,
    accessToken: "tok",
    collectorType: "PHOTOGRAPHER",
    collectorUserId: 3,
  })),
}));
vi.mock("@/lib/mercadopago/mp-oauth-token-refresh", () => ({
  buildMercadoPagoUnauthorizedRefresher: vi.fn(),
  isMercadoPagoUnauthorizedError: () => false,
  MP_TOKEN_EXPIRED_BUYER_ERROR: "x",
  MP_TOKEN_EXPIRED_CODE: "y",
}));
vi.mock("@/lib/pricing/client-price", () => ({ resolveClientMarketplaceFeePercent: vi.fn(async () => 10) }));
vi.mock("@/lib/services/commissionService", () => ({ resolvePlatformCommissionPercent: vi.fn(async () => 10) }));
vi.mock("@/lib/referral/referral-marketplace-fee", () => ({
  applyAndPersistSellerReferralDiscount: vi.fn(async ({ marketplaceFeeCents }: { marketplaceFeeCents: number }) => ({ marketplaceFeeCents })),
}));
vi.mock("@/lib/antifraud/audit", () => ({
  registerAuditEvent: m.registerAuditEvent,
  getRequestMetadata: () => ({ ipAddress: "1.2.3.4", userAgent: "test" }),
}));
vi.mock("@/lib/legal/checkout-terms", () => ({ buildCheckoutTermsAcceptanceMetadata: () => ({}) }));
vi.mock("@/lib/orders/create-album-order-print-order-mirror", () => ({
  createAlbumOrderPrintOrderMirror: vi.fn(),
  syncAlbumOrderPrintMirrorContact: vi.fn(),
}));
vi.mock("@/lib/canje-externo/prepaid-print-credit", () => ({ applyPrepaidPrintCredit: vi.fn() }));
vi.mock("@/lib/canje-externo/external-voucher", () => ({
  attachVoucherToOrder: vi.fn(),
  EXTERNAL_VOUCHER_ERROR_MESSAGES: {},
  loadExternalVoucherByToken: vi.fn(),
}));
vi.mock("@/lib/canje-externo/complete-prepaid-order", () => ({ completePrepaidAlbumOrder: vi.fn() }));
vi.mock("@/lib/mercadopago", () => ({ createPreference: m.createPreference }));

import { POST } from "./route";

const CLAVE = "0123456789abcdef0123456789abcdef";

function pedir(cookie?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  const req = new Request("https://compramelafoto.com/api/a/7/orders", {
    method: "POST",
    headers,
    body: JSON.stringify({
      buyerEmail: "Juan@Example.com",
      buyerName: "Juan",
      buyerPhone: "3415551234",
      termsAccepted: true,
      items: [{ fileKey: "photo:55", tipo: "digital", quantity: 1, priceCents: 9000 }],
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(Object.assign(req, { nextUrl: new URL(req.url) }) as any, { params: Promise.resolve({ id: "7" }) });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  m.album.findUnique.mockReset().mockResolvedValue({
    id: 7, userId: 3, eventId: null, isTest: false, isPublic: true, isHidden: false,
    enablePrintedPhotos: false, enableDigitalPhotos: true, selectedLabId: null,
    albumProfitMarginPercent: null, pickupBy: null, digitalPhotoPriceCents: 9000,
    termsAcceptedAt: null, termsVersion: null, photos: [{ id: 55, originalKey: "k/55.jpg", userId: 3 }],
  });
  m.order.findMany.mockReset().mockResolvedValue([]);
  m.order.create.mockReset().mockResolvedValue({ id: 900, totalCents: 9000, extensionSurchargeCents: 0, items: [{ productType: "DIGITAL" }] });
  m.order.update.mockReset().mockResolvedValue({ id: 900 });
  m.createPreference.mockReset().mockResolvedValue({ initPoint: "https://mp/redirect", preferenceId: "pref-1" });
  m.registerAuditEvent.mockReset();
});

const ESPERADO = { id: 900, totalCents: 9000, initPoint: "https://mp/redirect", preferenceId: "pref-1" };
const llamadasBot = () => m.order.update.mock.calls.filter(([a]) => a?.data && "botGuestKey" in a.data);

describe("POST /api/a/[id]/orders", () => {
  it("crea el pedido y devuelve el link de pago (201)", async () => {
    const res = await pedir();
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(ESPERADO);
    expect(m.order.create).toHaveBeenCalledTimes(1);
    expect(m.order.update).toHaveBeenCalledWith({ where: { id: 900 }, data: { mpInitPoint: "https://mp/redirect", mpPreferenceId: "pref-1" } });
    expect(llamadasBot()).toHaveLength(0);
  });

  it("con la cookie del bot anota botGuestKey en el pedido y responde igual", async () => {
    const res = await pedir(`sesion=1; dnxbot_guest=${CLAVE}`);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(ESPERADO);
    expect(llamadasBot()).toEqual([[{ where: { id: 900 }, data: { botGuestKey: CLAVE }, select: { id: true } }]]);
  });

  it("si anotar botGuestKey falla, el pedido sigue igual", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.order.update.mockImplementation(async (a: { data: Record<string, unknown> }) => {
      if ("botGuestKey" in a.data) throw new Error("columna inexistente");
      return { id: 900 };
    });
    const res = await pedir(`dnxbot_guest=${CLAVE}`);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(ESPERADO);
    expect(m.createPreference).toHaveBeenCalledTimes(1);
  });
});
