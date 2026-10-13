import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Caracterización del pedido de preventa (camino feliz) y del vínculo con DNX Bot: con o sin la
 * cookie del bot, y aunque guardarla falle, la respuesta es la misma.
 */
const m = vi.hoisted(() => ({
  album: { findFirst: vi.fn() },
  photo: { count: vi.fn() },
  order: { findMany: vi.fn(), update: vi.fn() },
  preCompraOrder: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: m,
  CheckoutPaymentSource: { MERCADO_PAGO: "MERCADO_PAGO" },
  StudentIdentificationMode: { NONE: "NONE" },
  StudentSourceType: {},
}));
vi.mock("@/lib/preventa-canjeable/pack-service", () => ({
  listActivePacksForPublicCatalog: vi.fn(async () => [{ id: 4 }]),
}));
vi.mock("@/lib/pricing/fee-formula", () => ({ feeFromTotal: () => 1500 }));
vi.mock("@/lib/pricing/client-price", () => ({ resolveClientMarketplaceFeePercent: vi.fn(async () => 10) }));
vi.mock("@/lib/pricing/checkout-fee-shadow", () => ({ scheduleCheckoutFeeShadowCompare: vi.fn() }));
vi.mock("@/lib/preventa-canjeable/preventa-mode", () => ({
  getPreventaRequirements: () => ({ requiresSchoolData: false }),
  isSchoolAlbum: () => false,
}));
vi.mock("@/lib/school-roster/match-school-course-id", () => ({ matchSchoolCourseId: vi.fn() }));
vi.mock("@/lib/public-album-test-access", () => ({
  ALBUM_TEST_MODE_ERROR_CODE: "ALBUM_TEST_MODE",
  TEST_ALBUM_NO_ORDERS_MESSAGE: "prueba",
}));
vi.mock("@/lib/preventa-canjeable/precompra-pack-order-transaction", () => ({
  createPrecompraPackOrderInTransaction: vi.fn(),
}));
vi.mock("@/lib/preventa-canjeable/precompra-order-request-helpers", () => ({
  parsePrecompraRequest: (b: Record<string, unknown>) => b,
  hasLegacyAlbumProductItem: () => false,
  buildOrderItems: () => [{ packDefinitionId: 4, quantity: 1, priceCents: 1500000 }],
  mergePackLines: () => new Map([[4, { packDefinitionId: 4, quantity: 1 }]]),
  buildPricingSnapshot: () => ({}),
}));

import { POST } from "./route";

const CLAVE = "0123456789abcdef0123456789abcdef";
const CREADO = { id: 31, status: "CREATED", items: [] };

function pedir(cookie?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  const req = new Request("https://compramelafoto.com/api/precompra/order", {
    method: "POST",
    headers,
    body: JSON.stringify({
      albumId: 7,
      buyerEmail: "juan@example.com",
      buyerName: "Juan Pérez",
      buyerPhone: "3415551234",
      items: [{ packDefinitionId: 4, quantity: 1 }],
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return POST(req as any);
}

beforeEach(() => {
  vi.restoreAllMocks();
  m.album.findFirst.mockReset().mockResolvedValue({ id: 7, userId: 3, isTest: false, schoolId: null, selectedLabId: null, studentIdentificationMode: "NONE", school: null });
  m.photo.count.mockReset().mockResolvedValue(10);
  m.order.findMany.mockReset().mockResolvedValue([]);
  m.order.update.mockReset().mockResolvedValue({ id: 500 });
  m.preCompraOrder.findUnique.mockReset().mockResolvedValue(CREADO);
  m.$transaction.mockReset().mockResolvedValue({ preCompraOrder: { id: 31 }, albumPackOrder: { id: 500 } });
});

const ESPERADO = { order: CREADO, preCompraOrderId: 31, orderId: 500 };

describe("POST /api/precompra/order", () => {
  it("crea el pedido de preventa y devuelve sus números", async () => {
    const res = await pedir();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ESPERADO);
    expect(m.$transaction).toHaveBeenCalledTimes(1);
    expect(m.order.update).not.toHaveBeenCalled();
  });

  it("con la cookie del bot anota botGuestKey en el pedido y responde igual", async () => {
    const res = await pedir(`dnxbot_guest=${CLAVE}; otra=2`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ESPERADO);
    expect(m.order.update).toHaveBeenCalledWith({ where: { id: 500 }, data: { botGuestKey: CLAVE }, select: { id: true } });
  });

  it("si anotar botGuestKey falla, el pedido sigue igual", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.order.update.mockRejectedValue(new Error("columna inexistente"));
    const res = await pedir(`dnxbot_guest=${CLAVE}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(ESPERADO);
  });
});
