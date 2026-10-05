import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El freno por IP de "Pagar": un pedido con envío cotiza en el servidor (y puede pegarle a
 * Correo), así que se limita como cotizar. El retiro no cotiza nada y no se frena.
 */
const h = vi.hoisted(() => ({
  ip: "1.1.1.1",
  parseCheckoutInput: vi.fn(),
  createStoreOrder: vi.fn(),
  loadCheckoutDeliveryOptions: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": h.ip }),
  cookies: async () => ({ set: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://fotoffice.test" }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn(async () => null) }));
vi.mock("@/lib/portal/profiles", () => ({ listUserProfiles: vi.fn(async () => []) }));
vi.mock("@/lib/store/checkout-input", () => ({ parseCheckoutInput: h.parseCheckoutInput }));
vi.mock("@/lib/store/create-order", () => ({ createStoreOrder: h.createStoreOrder }));
vi.mock("@/lib/store/order-access", () => ({ storeOrderCookieName: vi.fn(), storeVisibleBase: vi.fn() }));
vi.mock("@/lib/store/payment", () => ({ startStoreCheckout: vi.fn() }));
vi.mock("@/lib/store/repository", () => ({
  loadOpenStore: vi.fn(async () => ({ workspace: { id: "ws1", slug: "sfpr", name: "SFPR" } })),
}));
vi.mock("@/lib/store/shipping/checkout-server", () => ({
  listAgenciesForCheckout: vi.fn(),
  loadCheckoutDeliveryOptions: h.loadCheckoutDeliveryOptions,
  quoteForCheckout: vi.fn(),
}));
vi.mock("@/lib/website/domain/normalize", () => ({ hostWithoutPort: (v: string) => v }));

const { placeOrderAction } = await import("./actions");

function conMetodo(method: "PICKUP" | "HOME" | "BRANCH") {
  h.parseCheckoutInput.mockReturnValue({ ok: true, value: { delivery: { method } } });
}

beforeEach(() => {
  h.parseCheckoutInput.mockReset();
  h.createStoreOrder.mockReset().mockResolvedValue({ ok: false, error: "algo" });
  h.loadCheckoutDeliveryOptions.mockReset().mockResolvedValue({ pickup: true, home: true, branch: true, handlingNote: null });
});

describe("placeOrderAction — freno por IP", () => {
  it("con envío: 20 pedidos cada 5 minutos por IP; el 21 se frena sin crear el pedido", async () => {
    h.ip = "10.0.0.1";
    conMetodo("HOME");
    for (let i = 0; i < 20; i++) {
      expect((await placeOrderAction("sfpr", {})).error).toBe("algo");
    }
    const r = await placeOrderAction("sfpr", {});
    expect(r).toEqual({ ok: false, error: "Hiciste muchas consultas seguidas. Esperá unos minutos y probá de nuevo." });
    expect(h.createStoreOrder).toHaveBeenCalledTimes(20);

    // Otra IP no comparte el conteo.
    h.ip = "10.0.0.2";
    conMetodo("BRANCH");
    expect((await placeOrderAction("sfpr", {})).error).toBe("algo");
  });

  it("el retiro no se frena", async () => {
    h.ip = "10.0.0.3";
    conMetodo("PICKUP");
    for (let i = 0; i < 25; i++) await placeOrderAction("sfpr", {});
    expect(h.createStoreOrder).toHaveBeenCalledTimes(25);
  });
});
