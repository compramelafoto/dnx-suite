import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeOrder, createPreference, resolveWorkspaceCollector, getPlatformFeeBps, pendingFeeDebtMinor } = vi.hoisted(
  () => ({
    storeOrder: { findFirst: vi.fn(), updateMany: vi.fn() },
    createPreference: vi.fn(),
    resolveWorkspaceCollector: vi.fn(),
    getPlatformFeeBps: vi.fn(),
    pendingFeeDebtMinor: vi.fn(),
  }),
);
vi.mock("@repo/db", () => ({ prisma: { storeOrder } }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: () => ({ createPreference }),
}));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector }));
vi.mock("@/lib/platform-fee/store", () => ({ getPlatformFeeBps }));
vi.mock("@/lib/platform-fee/ledger", () => ({ pendingFeeDebtMinor }));
vi.mock("@/lib/app-url", () => ({ appUrl: () => "https://app.test" }));

const { startStoreCheckout, storeCheckoutBlocker, storePaymentDescription, storeReturnUrls } = await import("./payment");

describe("storePaymentDescription", () => {
  it("nombra la institución y el número de pedido", () => {
    expect(storePaymentDescription("Sociedad Fotográfica", 42)).toBe("Compra en Sociedad Fotográfica — pedido #42");
  });
});

describe("storeReturnUrls", () => {
  it("agrega el resultado del pago a la vuelta", () => {
    expect(storeReturnUrls("https://app.test", "/w/sfpr/tienda/pedido/ped_x")).toEqual({
      successUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=ok",
      pendingUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=pendiente",
      failureUrl: "https://app.test/w/sfpr/tienda/pedido/ped_x?pago=error",
    });
  });

  it("si la vuelta ya trae parámetros (el token), suma con & sin romperlos", () => {
    expect(storeReturnUrls("https://app.test", "/w/sfpr/tienda/pedido/ped_x?t=abc").successUrl).toBe(
      "https://app.test/w/sfpr/tienda/pedido/ped_x?t=abc&pago=ok",
    );
  });
});

describe("storeCheckoutBlocker", () => {
  const now = new Date("2026-10-04T15:00:00Z");
  const vigente = { status: "PENDING_PAYMENT" as const, holdExpiresAt: new Date("2026-10-04T15:10:00Z"), totalMinor: 1000 };

  it("un pedido esperando el pago, con la retención vigente y algo que cobrar, se puede pagar", () => {
    expect(storeCheckoutBlocker(vigente, now)).toBeNull();
  });

  it("uno que ya no espera el pago, no", () => {
    expect(storeCheckoutBlocker({ ...vigente, status: "PAID" }, now)).toBe("Ese pedido ya no está esperando el pago.");
  });

  it("uno con la retención vencida, no: el stock ya se liberó", () => {
    expect(storeCheckoutBlocker({ ...vigente, holdExpiresAt: new Date("2026-10-04T15:00:00Z") }, now)).toMatch(/venció/);
    expect(storeCheckoutBlocker({ ...vigente, holdExpiresAt: null }, now)).toMatch(/venció/);
  });

  it("uno en cero, no", () => {
    expect(storeCheckoutBlocker({ ...vigente, totalMinor: 0 }, now)).toBe("Ese pedido no tiene nada que pagar.");
  });
});

describe("startStoreCheckout — la comisión se congela una sola vez", () => {
  const now = new Date("2026-10-04T15:00:00Z");
  const dec = (v: string) => ({ toString: () => v });
  const pedido = (over: Record<string, unknown> = {}) => ({
    id: "ord1",
    orderNumber: 7,
    status: "PENDING_PAYMENT",
    holdExpiresAt: new Date("2026-10-04T15:10:00Z"),
    totalArs: dec("10000.00"),
    buyerEmail: "ana@example.com",
    feeBps: 0,
    feeArs: dec("0.00"),
    mpPreferenceId: null,
    workspace: { name: "SFPR", fotofficeBranding: { commercialName: "Sociedad" } },
    ...over,
  });
  const entrada = { workspaceId: "ws1", orderId: "ord1", returnPath: "/w/sfpr/tienda/pedido/ped_x", now };

  beforeEach(() => {
    storeOrder.findFirst.mockReset();
    storeOrder.updateMany.mockReset().mockResolvedValue({ count: 1 });
    createPreference.mockReset().mockResolvedValue({ providerPreferenceId: "pref1", checkoutUrl: "https://mp/pagar" });
    resolveWorkspaceCollector.mockReset().mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
    getPlatformFeeBps.mockReset().mockResolvedValue(500);
    pendingFeeDebtMinor.mockReset().mockResolvedValue(0);
  });

  it("la primera vez calcula (propia + deuda), congela y retiene eso", async () => {
    pendingFeeDebtMinor.mockResolvedValue(300_00);
    storeOrder.findFirst.mockResolvedValue(pedido());

    const r = await startStoreCheckout(entrada);

    expect(r).toEqual({ ok: true, checkoutUrl: "https://mp/pagar" });
    expect(storeOrder.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "ord1", workspaceId: "ws1", status: "PENDING_PAYMENT" },
      data: { feeBps: 500, feeArs: "800.00" },
    });
    expect(createPreference).toHaveBeenCalledWith(
      expect.objectContaining({ marketplaceFeeMinor: 800_00, description: "Compra en Sociedad — pedido #7" }),
    );
  });

  it("si ya se abrió un pago, reusa lo congelado aunque la deuda o la comisión hayan cambiado", async () => {
    getPlatformFeeBps.mockResolvedValue(900);
    pendingFeeDebtMinor.mockResolvedValue(5_000_00);
    storeOrder.findFirst.mockResolvedValue(pedido({ mpPreferenceId: "pref0", feeBps: 500, feeArs: dec("800.00") }));

    await startStoreCheckout(entrada);

    expect(getPlatformFeeBps).not.toHaveBeenCalled();
    expect(pendingFeeDebtMinor).not.toHaveBeenCalled();
    expect(storeOrder.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "ord1", workspaceId: "ws1", status: "PENDING_PAYMENT" },
      data: { feeBps: 500, feeArs: "800.00" },
    });
    expect(createPreference).toHaveBeenCalledWith(expect.objectContaining({ marketplaceFeeMinor: 800_00 }));
  });

  it("si al congelar ya no estaba esperando el pago (count 0), no abre otro pago", async () => {
    storeOrder.findFirst.mockResolvedValue(pedido());
    storeOrder.updateMany.mockResolvedValue({ count: 0 });

    const r = await startStoreCheckout(entrada);

    expect(r).toEqual({ ok: false, error: "Ese pedido ya no está esperando el pago." });
    expect(createPreference).not.toHaveBeenCalled();
  });
});
