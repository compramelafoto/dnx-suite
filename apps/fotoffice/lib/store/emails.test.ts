import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {
    storeOrder: { findFirst: vi.fn() },
    storeSettings: { findUnique: vi.fn() },
    workspace: { findUnique: vi.fn() },
    fotofficeWorkspaceDomain: { findUnique: vi.fn() },
  },
  sendAndLogEmail: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/communications/send-and-log", () => ({ sendAndLogEmail: h.sendAndLogEmail }));

const { sendOrderPaidEmail, sendPaidNoStockAlert, sendDuplicatePaymentAlert } = await import("./emails");

const ref = { workspaceId: "ws1", orderId: "ord1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.app");
  vi.stubEnv("STORE_ORDER_TOKEN_SECRET", "clave");
  h.prisma.storeOrder.findFirst.mockResolvedValue({
    id: "ord1",
    publicId: "ped_abcdefgh",
    orderNumber: 3,
    buyerName: "Ana",
    buyerEmail: "ana@example.com",
    buyerPhone: null,
    totalArs: "100.00",
    items: [{ productName: "Taza", variantName: null, qty: 1, lineTotalArs: "100.00" }],
  });
  h.prisma.storeSettings.findUnique.mockResolvedValue({
    pickupAddress: "Calle 1",
    pickupHours: null,
    pickupInstructions: null,
    notifyEmail: "tienda@sfpr.org",
  });
  h.prisma.workspace.findUnique.mockResolvedValue({
    name: "SFPR",
    fotofficeBranding: { publicSlug: "sfpr", commercialName: "Sociedad Fotográfica" },
  });
  h.prisma.fotofficeWorkspaceDomain.findUnique.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("emails de la tienda", () => {
  it("al comprador, con el enlace a su pedido y el pedido leído con el workspace", async () => {
    await sendOrderPaidEmail(ref);
    expect(h.prisma.storeOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ord1", workspaceId: "ws1" } }),
    );
    const llamada = h.sendAndLogEmail.mock.calls[0]![0];
    expect(llamada.to).toBe("ana@example.com");
    expect(llamada.templateKey).toBe("store.order_paid");
    expect(llamada.body.text).toContain("https://fotoffice.app/w/sfpr/tienda/pedido/ped_abcdefgh?t=");
  });

  it("con dominio propio conectado, el enlace es del dominio de la institución", async () => {
    h.prisma.fotofficeWorkspaceDomain.findUnique.mockResolvedValue({ domain: "sfpr.com.ar", status: "CONNECTED" });
    await sendOrderPaidEmail(ref);
    expect(h.sendAndLogEmail.mock.calls[0]![0].body.text).toContain("https://sfpr.com.ar/tienda/pedido/ped_abcdefgh?t=");
  });

  it("sin clave para el token, el correo sale sin enlace", async () => {
    vi.stubEnv("STORE_ORDER_TOKEN_SECRET", "");
    vi.stubEnv("FOTOFFICE_CRON_SECRET", "");
    vi.stubEnv("CRON_SECRET", "");
    await sendOrderPaidEmail(ref);
    expect(h.sendAndLogEmail).toHaveBeenCalledTimes(1);
    expect(h.sendAndLogEmail.mock.calls[0]![0].body.text).not.toContain("/pedido/");
  });

  it("los avisos a la institución van al email de avisos", async () => {
    await sendDuplicatePaymentAlert({ ...ref, providerPaymentId: "999" });
    const llamada = h.sendAndLogEmail.mock.calls[0]![0];
    expect(llamada.to).toBe("tienda@sfpr.org");
    expect(llamada.templateKey).toBe("store.duplicate_payment");
    expect(llamada.body.text).toContain("999");
  });

  it("sin email de avisos: no se envía y el aviso en el log no lleva datos personales", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.prisma.storeSettings.findUnique.mockResolvedValue({ notifyEmail: "  " });
    await sendPaidNoStockAlert(ref);
    expect(h.sendAndLogEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("ana@example.com");
    warn.mockRestore();
  });

  it("nunca lanza: si la base falla, sólo queda un registro", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    h.prisma.storeOrder.findFirst.mockRejectedValue(new Error("ana@example.com se cayó"));
    await expect(sendOrderPaidEmail(ref)).resolves.toBeUndefined();
    expect(JSON.stringify(err.mock.calls)).not.toContain("ana@example.com");
    err.mockRestore();
  });
});
