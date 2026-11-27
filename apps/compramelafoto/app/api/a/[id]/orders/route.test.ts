import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caracterización del checkout de álbum (camino feliz hasta el link de Mercado Pago) y del
 * vínculo con DNX Bot: con o sin la cookie del bot, y aunque guardarla falle, la respuesta es la misma.
 */
const m = vi.hoisted(() => ({
  album: { findUnique: vi.fn() },
  order: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  photographerLabContact: { findMany: vi.fn() },
  createPreference: vi.fn(),
  registerAuditEvent: vi.fn(),
}));

// Dueño del álbum sin la etiqueta demo: el checkout sigue por Mercado Pago.
vi.mock("@/lib/prisma", () => ({
  prisma: { album: m.album, order: m.order, photographerLabContact: m.photographerLabContact, user: { findUnique: vi.fn(async () => ({ id: 1, tags: [] })) } },
}));
vi.mock("@/lib/demos/sesion-demo", () => ({ getDemoActiva: vi.fn(async () => null) }));
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
vi.mock("@/lib/album-helpers", () => ({ isAlbumOpenByLink: () => true }));
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
import { loadExternalVoucherByToken } from "@/lib/canje-externo/external-voucher";
import { applyPrepaidPrintCredit as aplicarCredito } from "@/lib/canje-externo/prepaid-print-credit";
import { marcarPedidoDeCarrito } from "@/lib/split-1n-carrito-evento/pedido-interno";

const CLAVE = "0123456789abcdef0123456789abcdef";

function pedir(cookie?: string, extra: Record<string, unknown> = {}, carrito = false) {
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
      ...extra,
    }),
  });
  const conUrl = Object.assign(req, { nextUrl: new URL(req.url) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST((carrito ? marcarPedidoDeCarrito(conUrl) : conUrl) as any, { params: Promise.resolve({ id: "7" }) });
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
  m.photographerLabContact.findMany.mockReset().mockResolvedValue([]);
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

// Punto de retiro (diseño §4.2): el servidor nunca frena la venta por esto.
const IMPRESA = [{ fileKey: "photo:55", tipo: "impresa", size: "10x15", quantity: 1, priceCents: 9000 }];
const contacto = (id: number, nombre: string) => ({
  id, nombre, puntoDeRetiro: true, activo: true, direccion: `Calle ${id}`, horario: "9 a 18", lab: null,
});
const guardado = () => m.order.create.mock.calls[0]?.[0]?.data?.pickupLabContactId;

describe("POST /api/a/[id]/orders · punto de retiro", () => {
  beforeEach(() => {
    m.photographerLabContact.findMany.mockResolvedValue([contacto(1, "A"), contacto(2, "B")]);
  });

  it("varios puntos y sin elegir: crea el pedido igual, sin punto (no 400)", async () => {
    const res = await pedir(undefined, { items: IMPRESA });
    expect(res.status).toBe(201);
    expect(guardado()).toBeUndefined();
    expect(m.photographerLabContact.findMany).toHaveBeenCalledTimes(1);
  });

  it("id que no es del fotógrafo: crea el pedido sin punto", async () => {
    const res = await pedir(undefined, { items: IMPRESA, pickupLabContactId: 99 });
    expect(res.status).toBe(201);
    expect(guardado()).toBeUndefined();
  });

  it("id válido: lo guarda en el pedido", async () => {
    const res = await pedir(undefined, { items: IMPRESA, pickupLabContactId: 2 });
    expect(res.status).toBe(201);
    expect(guardado()).toBe(2);
  });

  it("un solo punto y sin id: guarda ese", async () => {
    m.photographerLabContact.findMany.mockResolvedValue([contacto(5, "Único")]);
    await pedir(undefined, { items: IMPRESA });
    expect(guardado()).toBe(5);
  });

  it("si la consulta falla, el pedido sigue sin punto", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.photographerLabContact.findMany.mockRejectedValue(new Error("tabla inexistente"));
    const res = await pedir(undefined, { items: IMPRESA, pickupLabContactId: 2 });
    expect(res.status).toBe(201);
    expect(guardado()).toBeUndefined();
  });

  it("retira el fotógrafo: no consulta ni guarda", async () => {
    m.album.findUnique.mockResolvedValue({ ...(await m.album.findUnique()), pickupBy: "PHOTOGRAPHER" });
    await pedir(undefined, { items: IMPRESA, pickupLabContactId: 2 });
    expect(m.photographerLabContact.findMany).not.toHaveBeenCalled();
    expect(guardado()).toBeUndefined();
  });

  it("sólo digitales: no consulta ni guarda", async () => {
    await pedir(undefined, { pickupLabContactId: 2 });
    expect(m.photographerLabContact.findMany).not.toHaveBeenCalled();
    expect(guardado()).toBeUndefined();
  });

  it("con canje: no consulta ni guarda", async () => {
    vi.mocked(loadExternalVoucherByToken).mockResolvedValue({
      ok: true,
      voucher: { redeemed: false, refs: [] },
    } as never);
    vi.mocked(aplicarCredito).mockImplementation(((totals: unknown) => ({ totals, creditedPrintUnits: 0 })) as never);
    const res = await pedir(undefined, { items: IMPRESA, canjeToken: "tok-canje", pickupLabContactId: 2 });
    expect(res.status).toBe(201);
    expect(m.photographerLabContact.findMany).not.toHaveBeenCalled();
    expect(guardado()).toBeUndefined();
  });

  it("carrito de evento: no consulta ni guarda", async () => {
    const res = await pedir(undefined, { items: IMPRESA, pickupLabContactId: 2 }, true);
    expect(res.status).toBeLessThan(300);
    expect(m.order.create).toHaveBeenCalledTimes(1);
    expect(m.photographerLabContact.findMany).not.toHaveBeenCalled();
    expect(guardado()).toBeUndefined();
  });
});
