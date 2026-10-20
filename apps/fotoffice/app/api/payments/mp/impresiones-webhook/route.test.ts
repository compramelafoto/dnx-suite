import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  yaPago: vi.fn(async (..._a: unknown[]) => null as unknown),
  getPayment: vi.fn(),
  collector: vi.fn(async (..._a: unknown[]) => ({ ok: true, collector: { accessToken: "tok" } }) as unknown),
  acreditar: vi.fn(async (..._a: unknown[]) => ({ ok: true, yaEstaba: false }) as unknown),
}));
vi.mock("@repo/db", () => ({ prisma: { fotofficePrintOrder: { findFirst: H.yaPago } } }));
vi.mock("@repo/payments/mercado-pago", () => ({ createMercadoPagoCheckoutProLiveAdapter: () => ({ getPayment: H.getPayment }) }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: () => "x" }));
vi.mock("@/lib/impresiones/acreditar-servidor", () => ({ acreditarPagoImpresion: H.acreditar }));
vi.mock("@/lib/impresiones/pago-servidor", () => ({
  pedidoDeReferencia: (raw: unknown) => (typeof raw === "string" && raw.startsWith("fo-impresion:") && raw.length > 13 ? raw.slice(13) : null),
}));
const R = await import("./route");

const pago = (o: Record<string, unknown> = {}) => ({
  providerPaymentId: "123", status: "APPROVED", amountMinor: 100000, currency: "ARS", externalReference: "fo-impresion:ord1", rawSanitized: { status: "approved" }, ...o,
});
const aviso = (ws: string | null = "ws1", id = "123") =>
  new Request(`https://app.test/api/payments/mp/impresiones-webhook?${ws ? `ws=${ws}&` : ""}type=payment&data.id=${id}`, {
    method: "POST",
    body: JSON.stringify({ type: "payment", data: { id } }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  H.yaPago.mockResolvedValue(null);
  H.collector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
  H.getPayment.mockResolvedValue(pago());
});

describe("aviso de Mercado Pago para pedidos de impresión", () => {
  it("acredita el pago leído con el token del estudio", async () => {
    const r = await R.POST(aviso());
    expect(r.status).toBe(200);
    expect(H.collector).toHaveBeenCalledWith("ws1");
    expect(H.getPayment).toHaveBeenCalledWith("123");
    expect(H.acreditar).toHaveBeenCalledWith("ws1", expect.objectContaining({ providerPaymentId: "123" }));
    expect(await r.json()).toMatchObject({ ok: true, applied: true });
  });
  it("ignora pagos de otra cosa", async () => {
    H.getPayment.mockResolvedValue(pago({ externalReference: "fo-galcompra:x" }));
    const r = await R.POST(aviso());
    expect(r.status).toBe(200);
    expect(H.acreditar).not.toHaveBeenCalled();
  });
  it("sin `ws` válido no hace nada", async () => {
    const r = await R.POST(aviso(null));
    expect(r.status).toBe(200);
    expect(H.getPayment).not.toHaveBeenCalled();
    expect(H.acreditar).not.toHaveBeenCalled();
  });
  it("un pago ya acreditado y devuelto sólo se avisa en el log, sin cambiar nada", async () => {
    H.yaPago.mockResolvedValue({ workspaceId: "ws1" });
    H.getPayment.mockResolvedValue(pago({ status: "REFUNDED", rawSanitized: { status: "refunded" } }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await R.POST(aviso());
    expect(r.status).toBe(200);
    expect(H.acreditar).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it("un aviso repetido de un pago ya acreditado no hace nada", async () => {
    H.yaPago.mockResolvedValue({ workspaceId: "ws1" });
    const r = await R.POST(aviso());
    expect(r.status).toBe(200);
    expect(H.acreditar).not.toHaveBeenCalled();
  });
  it("siempre responde 200, aun si algo falla", async () => {
    H.acreditar.mockRejectedValue(new Error("base caída"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await R.POST(aviso());
    expect(r.status).toBe(200);
    err.mockRestore();
  });
  it("GET sigue el mismo camino", async () => {
    const r = await R.GET(new Request("https://app.test/api/payments/mp/impresiones-webhook?ws=ws1&type=payment&data.id=123"));
    expect(r.status).toBe(200);
    expect(H.acreditar).toHaveBeenCalled();
  });
});
