import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalSaleOrder: { updateMany: vi.fn() },
  culturalEditionCopy: { updateMany: vi.fn(), findUnique: vi.fn() },
  culturalWorkOffer: { findUnique: vi.fn() },
  culturalActivityWork: { findUnique: vi.fn() },
  culturalSaleEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const estado = vi.hoisted(() => ({
  pedido: null as Record<string, unknown> | null,
  modo: "TEST" as "OFF" | "TEST" | "LIVE",
  consent: {} as Record<number, { status: string; receiverId: string | null; verificado: boolean }>,
}));
const mp = vi.hoisted(() => ({ createSplitOrder: vi.fn(), leerOrden: vi.fn() }));
const conciliar = vi.hoisted(() => ({ conciliarDesdeOrden: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => ({ id: 60, esSuperAdmin: false, email: "p@x", name: "P" }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("./modo", () => ({ configVerificada: async () => ({ modo: estado.modo, ambienteCuenta: "SANDBOX", probadores: new Set([60]) }) }));
vi.mock("./config", () => ({ puedeComprar: (_u: unknown, c: { modo: string }) => c.modo !== "OFF" }));
vi.mock("./cuentas", () => ({ consentimientoVigente: async (userId: number) => estado.consent[userId] }));
vi.mock("./pedido", () => ({ nombreCookieDePedido: (p: string) => `mf_pedido_${p}`, pedidoConAcceso: async () => estado.pedido }));
vi.mock("./conciliar", () => conciliar);
vi.mock("./mp", async () => {
  const real = await vi.importActual<typeof import("./mp")>("./mp");
  return { ordenLeidaDesde: real.ordenLeidaDesde, leerOrden: mp.leerOrden, adaptadorDeOrdenes: () => ({ createSplitOrder: mp.createSplitOrder }) };
});

const { pagarPedido } = await import("./pagar");
const { resetRateLimit } = await import("@/lib/limite");

const ORG = "11111111-1111-4111-8111-111111111111";
const FOTO = "22222222-2222-4222-8222-222222222222";
const foto = (partners = [{ recipientId: "organizer", receiverId: ORG, cents: 2_500_000 }, { recipientId: "photographer", receiverId: FOTO, cents: 6_000_000 }]) => ({
  v: 1, environment: "SANDBOX", ownerUserId: "999", ownerCents: 1_500_000, partners,
  organizer: { userId: 7, receiverId: ORG }, photographer: { userId: 50, receiverId: partners.length === 1 ? ORG : FOTO },
});
const pedidoBase = () => ({
  id: "o1", publicId: "abcd1234abcd1234", isTest: true, status: "PENDING_PAYMENT", providerOrderId: null, providerStatus: null,
  holdExpiresAt: new Date(Date.now() + 10 * 60_000), copyId: "c1", offerId: "of1", totalCents: 10_000_000,
  externalReference: "muestras-venta-abcd1234abcd1234", idempotencyKey: "idem-1", buyerEmail: "bea@testuser.com", splitSnapshot: foto(),
});
const entrada = (extra: Record<string, unknown> = {}) => ({
  publicId: "abcd1234abcd1234", token: "x".repeat(43), cardToken: "tok_SECRETO_tarjeta_123", paymentMethodId: "visa", installments: 1,
  identification: { type: "DNI", number: "30111222" }, deviceSessionId: "armor.sesion-de-prueba-123456789", payerFirstName: "Bea", payerLastName: "Compradora", ...extra,
});
const respuesta = (status: string, detail: string, payStatus = "processed") => ({
  providerOrderId: "ORD01ABC",
  status: "x",
  raw: {
    id: "ORD01ABC", status, status_detail: detail, external_reference: "muestras-venta-abcd1234abcd1234", total_amount: "100000.00",
    transactions: { payments: [{ id: "P1", status: payStatus, status_detail: detail }] },
  },
});

let logs: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  estado.pedido = pedidoBase();
  estado.modo = "TEST";
  estado.consent = { 7: { status: "ACTIVE", receiverId: ORG, verificado: true }, 50: { status: "ACTIVE", receiverId: FOTO, verificado: true } };
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => unknown) => fn(db));
  db.culturalSaleOrder.updateMany.mockResolvedValue({ count: 1 });
  db.culturalEditionCopy.updateMany.mockResolvedValue({ count: 1 });
  db.culturalWorkOffer.findUnique.mockResolvedValue({ activityWorkId: "aw1", format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 0 });
  db.culturalEditionCopy.findUnique.mockResolvedValue({ number: 3, kind: "COPY" });
  db.culturalActivityWork.findUnique.mockResolvedValue({ title: "Silos" });
  conciliar.conciliarDesdeOrden.mockResolvedValue({ estado: "PAID", cambio: true });
  logs = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
});
afterEach(() => logs.forEach((l) => l.mockRestore()));

const nadaSensibleEnLogs = () => {
  const todo = JSON.stringify(logs.flatMap((l) => l.mock.calls));
  expect(todo).not.toContain("tok_SECRETO");
  expect(todo).not.toContain("30111222");
};

describe("pagarPedido", () => {
  it("reserva vencida: no llama a Mercado Pago", async () => {
    estado.pedido = { ...pedidoBase(), holdExpiresAt: new Date(Date.now() - 1000) };
    expect(await pagarPedido(entrada())).toEqual({ ok: false, error: "La reserva venció. Volvé a la obra para empezar de nuevo." });
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });

  it("modo apagado o pedido de otro ambiente: no se paga", async () => {
    estado.modo = "LIVE";
    expect((await pagarPedido(entrada())).ok).toBe(false);
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });

  it("manda la distribución congelada: owner = fee y los dos partners, suma exacta", async () => {
    mp.createSplitOrder.mockResolvedValue(respuesta("processed", "accredited"));
    const r = await pagarPedido(entrada());
    expect(r).toEqual({ ok: true, estado: "PAID", mensaje: "¡Listo! Tu pago está confirmado." });
    const x = mp.createSplitOrder.mock.calls[0]![0];
    expect(x.idempotencyKey).toBe("idem-1");
    expect(x.installments).toBe(1);
    expect(x.externalReference).toBe("muestras-venta-abcd1234abcd1234");
    const suma = x.distribution.entries.reduce((s: bigint, en: { amount: { amountMinor: bigint } }) => s + en.amount.amountMinor, 0n);
    expect(suma).toBe(10_000_000n);
    expect(x.distribution.entries.find((en: { recipientId: string }) => en.recipientId === "platform").amount.amountMinor).toBe(1_500_000n);
    expect([...x.partnerReceiverIds.entries()]).toEqual([["organizer", ORG], ["photographer", FOTO]]);
    expect(x.items[0]).toMatchObject({ title: "Silos — Copia impresa Fine Art / premium 3/10", categoryId: "art", quantity: 1 });
    // Guarda el id de la Order y concilia con la respuesta de la creación (sin GET extra).
    expect(db.culturalSaleOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerOrderId: "ORD01ABC" }) }));
    expect(conciliar.conciliarDesdeOrden).toHaveBeenCalledWith(expect.objectContaining({ providerOrderId: "ORD01ABC", status: "PROCESSED_ACCREDITED" }), "CREATE");
    expect(mp.leerOrden).not.toHaveBeenCalled();
    nadaSensibleEnLogs();
  });

  it("misma persona organiza y fotografía: un solo partner", async () => {
    estado.pedido = { ...pedidoBase(), splitSnapshot: foto([{ recipientId: "both", receiverId: ORG, cents: 8_500_000 }]) };
    estado.consent[50] = { status: "ACTIVE", receiverId: ORG, verificado: true };
    mp.createSplitOrder.mockResolvedValue(respuesta("processed", "accredited"));
    await pagarPedido(entrada());
    expect([...mp.createSplitOrder.mock.calls[0]![0].partnerReceiverIds.entries()]).toEqual([["both", ORG]]);
  });

  it("doble llamada: una sola creación", async () => {
    mp.createSplitOrder.mockResolvedValue(respuesta("processed", "accredited"));
    await pagarPedido(entrada());
    estado.pedido = { ...pedidoBase(), providerOrderId: "ORD01ABC", status: "PAID" };
    mp.leerOrden.mockResolvedValue({ providerOrderId: "ORD01ABC", status: "PROCESSED_ACCREDITED" });
    const r = await pagarPedido(entrada());
    expect(mp.createSplitOrder).toHaveBeenCalledTimes(1);
    expect(r).toMatchObject({ ok: true, estado: "PAID" });
  });

  it("si otro intento ya tomó el pedido, no crea otra Order", async () => {
    db.culturalSaleOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await pagarPedido(entrada())).toMatchObject({ ok: true, estado: "PENDING" });
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });

  it("consentimiento caído: pedido REJECTED, copia RELEASED y sin Order", async () => {
    estado.consent[50] = { status: "CANCELED", receiverId: FOTO, verificado: true };
    expect(await pagarPedido(entrada())).toEqual({ ok: false, error: "Esta obra no se puede comprar ahora." });
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
    expect(db.culturalSaleOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "REJECTED" }) }));
    expect(db.culturalEditionCopy.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RELEASED" }) }));
  });

  it("consentimiento con otro receptor (cambió la cuenta): no se paga", async () => {
    estado.consent[7] = { status: "ACTIVE", receiverId: "33333333-3333-4333-8333-333333333333", verificado: true };
    expect((await pagarPedido(entrada())).ok).toBe(false);
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });

  it("Mercado Pago no responde la verificación: no se rechaza, se pide reintentar", async () => {
    estado.consent[7] = { status: "ACTIVE", receiverId: ORG, verificado: false };
    expect((await pagarPedido(entrada())).ok).toBe(false);
    expect(db.culturalSaleOrder.updateMany).not.toHaveBeenCalled();
  });

  it("rechazo de la tarjeta: concilia y devuelve el mensaje del detalle", async () => {
    mp.createSplitOrder.mockResolvedValue(respuesta("failed", "failed", "rejected"));
    mp.createSplitOrder.mockResolvedValue({
      ...respuesta("failed", "failed", "rejected"),
      raw: { ...respuesta("failed", "failed").raw, transactions: { payments: [{ id: "P1", status: "rejected", status_detail: "cc_rejected_insufficient_amount" }] } },
    });
    conciliar.conciliarDesdeOrden.mockResolvedValue({ estado: "REJECTED", cambio: true });
    expect(await pagarPedido(entrada())).toEqual({ ok: true, estado: "REJECTED", mensaje: "No hay fondos suficientes en la tarjeta." });
  });

  it("error 400 de Mercado Pago: REJECTED y copia RELEASED", async () => {
    mp.createSplitOrder.mockRejectedValue(Object.assign(new Error("bad request token=tok_SECRETO_tarjeta_123"), { code: "PROVIDER_VALIDATION", statusCode: 400 }));
    expect(await pagarPedido(entrada())).toMatchObject({ ok: true, estado: "REJECTED" });
    expect(db.culturalEditionCopy.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "RELEASED" }) }));
    nadaSensibleEnLogs();
  });

  it("error de red: queda pendiente con UNKNOWN_CREATE y sin rechazar", async () => {
    mp.createSplitOrder.mockRejectedValue(Object.assign(new Error("socket hang up"), { code: "PROVIDER_TEMPORARY", statusCode: 503 }));
    expect(await pagarPedido(entrada())).toMatchObject({ ok: true, estado: "PENDING" });
    expect(db.culturalSaleOrder.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ providerStatus: "UNKNOWN_CREATE" }) }));
    expect(db.culturalEditionCopy.updateMany).not.toHaveBeenCalled();
    expect(db.culturalSaleEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ detail: expect.stringContaining("ALERT_UNKNOWN_CREATE") }) }));
  });

  it("pedido con UNKNOWN_CREATE: nunca se reintenta la creación", async () => {
    estado.pedido = { ...pedidoBase(), providerStatus: "UNKNOWN_CREATE" };
    expect(await pagarPedido(entrada())).toMatchObject({ ok: true, estado: "PENDING" });
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });

  it("con cuotas o sin documento: no se paga", async () => {
    expect((await pagarPedido(entrada({ installments: 3 }))).ok).toBe(false);
    expect((await pagarPedido(entrada({ identification: null }))).ok).toBe(false);
    expect(mp.createSplitOrder).not.toHaveBeenCalled();
  });
});
