import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
type Pedido = {
  id: string; workspaceId: string; number: number; status: string; totalArs: string; nombre: string; email: string; telefono: string | null;
  clientId: string | null; trackingToken: string; items: { id: string; proveedorId: string | null; quantity: number; unitCostArs: string }[];
};
const H = vi.hoisted(() => {
  const pedido: Pedido = {
    id: "ord1", workspaceId: "ws", number: 8, status: "PENDIENTE_PAGO", totalArs: "1000", nombre: "Juan Pérez", email: "j@t.com", telefono: null, clientId: "c1",
    trackingToken: "trk",
    items: [
      { id: "i1", proveedorId: "f", quantity: 2, unitCostArs: "200" },
      { id: "i2", proveedorId: "isla", quantity: 1, unitCostArs: "600" },
    ],
  };
  const db: Record<string, unknown> = {};
  Object.assign(db, {
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(db)),
    fotofficePrintOrder: {
      findUnique: vi.fn(async (..._a: unknown[]) => pedido as unknown),
      findFirst: vi.fn(async ({ where }: { where: { id: string; workspaceId: string } }) =>
        where.id === pedido.id && where.workspaceId === pedido.workspaceId ? { id: pedido.id, status: pedido.status, trackingToken: pedido.trackingToken } : null),
      updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
      update: vi.fn(async (..._a: unknown[]) => ({})),
    },
    fotofficePrintOrderItem: { updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })) },
    fotofficePrintSettings: { findUnique: vi.fn(async (..._a: unknown[]) => ({ circuitId: "circ" }) as unknown) },
    fotofficeCircuit: { findFirst: vi.fn(async (..._a: unknown[]) => ({ id: "circ" }) as unknown) },
    fotofficeProyecto: { update: vi.fn(async (..._a: unknown[]) => ({})) },
    cashAccount: { findMany: vi.fn(async () => [{ id: "acc", name: "MP", kind: "DIGITAL", isDefault: true, isVault: false }]) },
  });
  return {
    db,
    pedido,
    crear: vi.fn(async (_tx: unknown, _ws: string, d: { proveedorId: string | null }) => ({ id: `p-${d.proveedorId}`, number: "T-1" })),
    caja: vi.fn(async (..._a: unknown[]) => ({ id: "mov1", created: true })),
    destino: vi.fn((..._a: unknown[]) => ({ ok: true, accountId: "acc" }) as unknown),
    cajaEncendida: vi.fn(async (..._a: unknown[]) => true),
    aviso: vi.fn(async (..._a: unknown[]) => undefined),
    cliente: vi.fn(async (..._a: unknown[]) => ({ id: "c-nuevo", created: true })),
    getPayment: vi.fn(),
    buscar: vi.fn(),
    collector: vi.fn(async (..._a: unknown[]) => ({ ok: true, collector: { accessToken: "tok" } }) as unknown),
    whatsapp: vi.fn(async (..._a: unknown[]) => "ENVIADO"),
    falla: vi.fn(async (..._a: unknown[]) => undefined),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (f: () => unknown) => void f() }));
vi.mock("@repo/db", () => ({ prisma: H.db }));
vi.mock("@/lib/proyectos/crear", () => ({ crearProyectoDeSistema: H.crear }));
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement: H.caja }));
vi.mock("@/lib/cash/auto-deposit", () => ({ resolveDepositTarget: H.destino }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.cajaEncendida }));
vi.mock("@/lib/clients/find-or-create", () => ({ findOrCreateClient: H.cliente }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: () => ({ getPayment: H.getPayment, searchPaymentsByExternalReference: H.buscar }),
}));
vi.mock("./pago-servidor", () => ({
  referenciaPedido: (id: string) => `fo-impresion:${id}`,
  pedidoDeReferencia: (raw: unknown) => (typeof raw === "string" && raw.startsWith("fo-impresion:") && raw.length > 13 ? raw.slice(13) : null),
}));
vi.mock("./avisos-servidor", () => ({ avisarPedidoConfirmado: H.aviso }));
vi.mock("@/lib/bandeja/aviso-sistema", () => ({ enviarAvisoPorWhatsapp: H.whatsapp }));
vi.mock("./preparar-servidor", () => ({ avisarFallaAlEstudio: H.falla, avisarPagoARevisar: H.falla }));
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: vi.fn() }));
const A = await import("./acreditar-servidor");

const pago = (o: Partial<{ status: string; amountMinor: number; currency: string; externalReference: string }> = {}) => ({
  providerPaymentId: "mp-1", status: "approved", amountMinor: 100000, currency: "ARS", externalReference: "fo-impresion:ord1",
  rawSanitized: { status: o.status ?? "approved", fee_details: [{ type: "mercadopago_fee", amount: 61 }], date_approved: "2026-10-20T15:00:00.000-03:00" }, ...o,
});
const orden = H.db.fotofficePrintOrder as Record<string, ReturnType<typeof vi.fn>>;
const circuito = H.db.fotofficeCircuit as Record<string, ReturnType<typeof vi.fn>>;
const ajustes = H.db.fotofficePrintSettings as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
  H.pedido.status = "PENDIENTE_PAGO";
  H.pedido.clientId = "c1";
  ajustes.findUnique.mockResolvedValue({ circuitId: "circ" });
  circuito.findFirst.mockResolvedValue({ id: "circ" });
  H.cajaEncendida.mockResolvedValue(true);
  H.collector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
});

describe("acreditarPagoImpresion", () => {
  it("pasa a PAGADO, crea un trabajo por laboratorio y registra Caja", async () => {
    const r = await A.acreditarPagoImpresion("ws", pago());
    expect(r).toEqual({ ok: true, yaEstaba: false });
    const cambio = orden.updateMany.mock.calls[0][0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(cambio.where).toMatchObject({ id: "ord1", workspaceId: "ws", providerPaymentRef: null });
    expect(cambio.data).toMatchObject({ status: "PAGADO", providerPaymentRef: "mp-1", feeArs: "61.00", netArs: "939.00" });
    // Pagado el martes 20/10: dos días hábiles después es el jueves 22/10.
    expect((cambio.data.promisedAt as Date).toISOString().slice(0, 10)).toBe("2026-10-22");
    expect(H.crear).toHaveBeenCalledTimes(2);
    expect(H.crear.mock.calls.map((c) => (c[2] as { proveedorId: string }).proveedorId).sort()).toEqual(["f", "isla"]);
    expect(H.crear.mock.calls[0][2]).toMatchObject({ clientId: "c1", circuitId: "circ", baseDate: "2026-10-20" });
    const proyecto = H.db.fotofficeProyecto as Record<string, ReturnType<typeof vi.fn>>;
    expect(proyecto.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p-f" }, data: expect.objectContaining({ proveedorCostoArs: "400.00" }) }));
    expect(H.caja).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceModule: "impresiones", sourceRef: "ord1", amountMinor: 100000, kind: "INGRESO", accountId: "acc", paymentMethod: "MERCADO_PAGO" }));
    expect(orden.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { cashMovementId: "mov1" } });
    expect(H.aviso).toHaveBeenCalledWith("ws", "ord1");
  });
  it("un aviso repetido no duplica nada", async () => {
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    const r = await A.acreditarPagoImpresion("ws", pago());
    expect(r).toEqual({ ok: true, yaEstaba: true });
    expect(H.crear).not.toHaveBeenCalled();
    expect(H.caja).not.toHaveBeenCalled();
    expect(H.aviso).not.toHaveBeenCalled();
  });
  it("importe menor no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ amountMinor: 50000 }))).toEqual({ ok: false, error: "IMPORTE_MENOR" });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("otra moneda no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ currency: "USD" }))).toEqual({ ok: false, error: "MONEDA" });
  });
  it("pago no aprobado no acredita", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ status: "rejected" }))).toEqual({ ok: false, error: "NO_APROBADO" });
  });
  it("referencia ajena se ignora", async () => {
    expect(await A.acreditarPagoImpresion("ws", pago({ externalReference: "fo-galcompra:x" }))).toEqual({ ok: false, error: "NO_ES_IMPRESION" });
  });
  it("un pedido de otra organización no existe", async () => {
    expect(await A.acreditarPagoImpresion("otro-ws", pago())).toEqual({ ok: false, error: "NO_EXISTE" });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("sin Caja encendida queda PAGADO y con trabajos, sin movimiento", async () => {
    H.cajaEncendida.mockResolvedValue(false);
    expect(await A.acreditarPagoImpresion("ws", pago())).toEqual({ ok: true, yaEstaba: false });
    expect(H.crear).toHaveBeenCalledTimes(2);
    expect(H.caja).not.toHaveBeenCalled();
  });
  it("sin cliente en el pedido lo busca o lo crea y lo guarda, sin cortar", async () => {
    H.pedido.clientId = null;
    expect(await A.acreditarPagoImpresion("ws", pago())).toEqual({ ok: true, yaEstaba: false });
    expect(H.cliente).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ workspaceId: "ws", email: "j@t.com", firstName: "Juan", lastName: "Pérez" }));
    expect(orden.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { clientId: "c-nuevo" } });
    expect(H.crear.mock.calls[0][2]).toMatchObject({ clientId: "c-nuevo" });
  });
  it("sin el circuito de la configuración prueba el de nombre por omisión, el por omisión y cualquiera", async () => {
    ajustes.findUnique.mockResolvedValue({ circuitId: null });
    circuito.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "cualquiera" });
    await A.acreditarPagoImpresion("ws", pago());
    const wheres = circuito.findFirst.mock.calls.map((c) => (c[0] as { where: Record<string, unknown> }).where);
    expect(wheres[0]).toMatchObject({ workspaceId: "ws", name: "Impresiones a laboratorio", kind: "TRABAJO", isActive: true });
    expect(wheres[1]).toMatchObject({ workspaceId: "ws", isDefault: true, kind: "TRABAJO", isActive: true });
    expect(wheres[2]).toMatchObject({ workspaceId: "ws", kind: "TRABAJO", isActive: true });
    expect(H.crear.mock.calls[0][2]).toMatchObject({ circuitId: "cualquiera" });
  });
  it("sin ningún circuito de trabajo queda PAGADO con Caja, sin trabajos y con el error anotado", async () => {
    circuito.findFirst.mockResolvedValue(null);
    expect(await A.acreditarPagoImpresion("ws", pago())).toEqual({ ok: true, yaEstaba: false });
    expect(H.crear).not.toHaveBeenCalled();
    expect(orden.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { lastError: "No hay circuito de trabajo" } });
    expect(H.caja).toHaveBeenCalledTimes(1);
  });
});

describe("pago duplicado", () => {
  it("si el pedido ya tiene OTRO pago lo avisa en el log, sólo con códigos", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    orden.findUnique.mockResolvedValueOnce(H.pedido).mockResolvedValueOnce({ providerPaymentRef: "mp-anterior" });
    expect(await A.acreditarPagoImpresion("ws", pago())).toEqual({ ok: true, yaEstaba: true });
    expect(warn).toHaveBeenCalledWith("[impresiones] pago duplicado", { pedidoId: "ord1", ref: "mp-1" });
    warn.mockRestore();
  });
  it("el mismo pago repetido no avisa nada", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    orden.findUnique.mockResolvedValueOnce(H.pedido).mockResolvedValueOnce({ providerPaymentRef: "mp-1" });
    await A.acreditarPagoImpresion("ws", pago());
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("asegurarTrabajosDelPedido", () => {
  const conPagado = () => ({ ...H.pedido, status: "PREPARANDO", promisedAt: new Date("2026-10-22T12:00:00Z") });
  it("crea los trabajos que faltan con el mismo circuito que la acreditación", async () => {
    orden.findUnique.mockResolvedValueOnce(conPagado());
    expect(await A.asegurarTrabajosDelPedido("ws", "ord1", new Date("2026-10-21T15:00:00Z"))).toBe("OK");
    expect(H.crear).toHaveBeenCalledTimes(2);
    expect(H.crear.mock.calls[0][2]).toMatchObject({ clientId: "c1", circuitId: "circ", baseDate: "2026-10-21" });
    const items = H.db.fotofficePrintOrderItem as Record<string, ReturnType<typeof vi.fn>>;
    expect(items.updateMany).toHaveBeenCalledWith({ where: { orderId: "ord1", id: { in: ["i1"] } }, data: { proyectoId: "p-f" } });
  });
  it("sin circuito devuelve SIN_CIRCUITO y no crea nada", async () => {
    orden.findUnique.mockResolvedValueOnce(conPagado());
    circuito.findFirst.mockResolvedValue(null);
    expect(await A.asegurarTrabajosDelPedido("ws", "ord1", new Date())).toBe("SIN_CIRCUITO");
    expect(H.crear).not.toHaveBeenCalled();
  });
  it("si ya tiene todos sus trabajos no hace nada", async () => {
    orden.findUnique.mockResolvedValueOnce({ ...conPagado(), items: H.pedido.items.map((i) => ({ ...i, proyectoId: "p-x" })) });
    expect(await A.asegurarTrabajosDelPedido("ws", "ord1", new Date())).toBe("OK");
    expect(H.crear).not.toHaveBeenCalled();
  });
  it("un pedido de otra organización no se toca", async () => {
    orden.findUnique.mockResolvedValueOnce(conPagado());
    expect(await A.asegurarTrabajosDelPedido("otro-ws", "ord1", new Date())).toBe("NO_EXISTE");
    expect(H.crear).not.toHaveBeenCalled();
  });
});

describe("verificarVueltaImpresion", () => {
  it("aprobado: acredita una vez y devuelve PAGADO con el seguimiento", async () => {
    H.getPayment.mockResolvedValue(pago());
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "PAGADO", seguimiento: "trk" });
    expect(H.getPayment).toHaveBeenCalledWith("123");
    expect(orden.updateMany).toHaveBeenCalledTimes(1);
    expect(H.crear).toHaveBeenCalledTimes(2);
  });
  it("sin payment_id busca por la referencia del pedido", async () => {
    H.buscar.mockResolvedValue(pago());
    expect(await A.verificarVueltaImpresion("ws", "ord1", null)).toEqual({ estado: "PAGADO", seguimiento: "trk" });
    expect(H.buscar).toHaveBeenCalledWith("fo-impresion:ord1");
  });
  it("pendiente devuelve PENDIENTE sin acreditar", async () => {
    H.getPayment.mockResolvedValue(pago({ status: "in_process" }));
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "PENDIENTE", seguimiento: "trk" });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("rechazado o desconocido devuelve RECHAZADO", async () => {
    H.getPayment.mockResolvedValue(pago({ status: "rejected" }));
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "RECHAZADO", seguimiento: "trk" });
    H.getPayment.mockResolvedValue(pago({ status: "algo_raro" }));
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "RECHAZADO", seguimiento: "trk" });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("un pago de otro pedido no acredita", async () => {
    H.getPayment.mockResolvedValue(pago({ externalReference: "fo-impresion:otro" }));
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "RECHAZADO", seguimiento: "trk" });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("un pedido de otra organización: RECHAZADO sin consultar ni acreditar", async () => {
    expect(await A.verificarVueltaImpresion("otro-ws", "ord1", "123")).toEqual({ estado: "RECHAZADO", seguimiento: null });
    expect(H.getPayment).not.toHaveBeenCalled();
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
  it("un id con forma inválida: RECHAZADO", async () => {
    expect(await A.verificarVueltaImpresion("ws", { x: 1 }, "123")).toEqual({ estado: "RECHAZADO", seguimiento: null });
  });
  it("un pedido ya pagado devuelve PAGADO sin consultar", async () => {
    H.pedido.status = "PREPARANDO";
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "PAGADO", seguimiento: "trk" });
    expect(H.getPayment).not.toHaveBeenCalled();
  });
  it("si Mercado Pago no responde queda PENDIENTE (lo confirma el aviso)", async () => {
    H.getPayment.mockRejectedValue(new Error("caído"));
    expect(await A.verificarVueltaImpresion("ws", "ord1", "123")).toEqual({ estado: "PENDIENTE", seguimiento: "trk" });
  });
});

describe("acreditarPagoImpresion: pedidos del bot de WhatsApp", () => {
  const pedidoWa = (extra: Record<string, unknown> = {}) => ({
    ...H.pedido, email: null, source: "WHATSAPP", waId: "5493410000000", depositArs: "500", paidArs: "0", pagosExtra: null, lastError: null,
    providerPaymentRef: null,
    items: [
      { id: "i1", proveedorId: "f", quantity: 2, unitCostArs: "200", plazo: "MANANA" },
      { id: "i2", proveedorId: "f", quantity: 1, unitCostArs: "200", plazo: "SEMANA" },
      { id: "i3", proveedorId: null, quantity: 1, unitCostArs: "0", plazo: "INSTANTANEA" },
    ],
    ...extra,
  });

  it("con la seña pasa a PAGADO, guarda lo pagado y avisa por WhatsApp (sin correo)", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    const r = await A.acreditarPagoImpresion("ws", pago({ amountMinor: 50000 }));
    expect(r).toEqual({ ok: true, yaEstaba: false });
    expect((orden.updateMany.mock.calls[0][0] as { data: Record<string, unknown> }).data).toMatchObject({ status: "PAGADO", paidArs: "500.00" });
    expect(H.caja).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountMinor: 50000 }));
    expect(H.aviso).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(H.whatsapp).toHaveBeenCalledTimes(1));
    const [ws, waId, texto, opciones] = H.whatsapp.mock.calls[0] as [string, string, string, { autor: string }];
    expect([ws, waId, opciones.autor]).toEqual(["ws", "5493410000000", "Pedidos de impresión"]);
    expect(texto).toContain("Recibimos tu pago");
    expect(texto).toContain("saldo de $");
  });

  it("menos que la seña no acredita", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    expect(await A.acreditarPagoImpresion("ws", pago({ amountMinor: 49999 }))).toEqual({ ok: false, error: "IMPORTE_MENOR" });
  });

  it("un trabajo por laboratorio y plazo, con su nombre y su fecha", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    await A.acreditarPagoImpresion("ws", pago({ amountMinor: 50000 }));
    expect(H.crear.mock.calls.map((c) => (c[2] as unknown as { nombre: string }).nombre).sort()).toEqual([
      "Copias impresas · pedido 8 · para la próxima semana",
      "Copias impresas · pedido 8 · para mañana",
      "Copias instantáneas · pedido 8",
    ]);
  });

  it("un segundo pago (el total después de la seña) suma al saldo y no crea trabajos de nuevo", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    orden.findUnique.mockResolvedValueOnce({ status: "PAGADO", providerPaymentRef: "mp-1", paidArs: "500", totalArs: "1000", pagosExtra: null, lastError: null });
    const r = await A.acreditarPagoImpresion("ws", { ...pago({ amountMinor: 50000 }), providerPaymentId: "mp-2" });
    expect(r).toEqual({ ok: true, yaEstaba: false });
    expect(orden.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { paidArs: "1000.00", pagosExtra: ["mp-2"] } });
    expect(H.caja).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceRef: "ord1:2", amountMinor: 50000 }));
    expect(H.crear).not.toHaveBeenCalled();
  });

  it("el mismo segundo pago repetido no suma otra vez", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    orden.findUnique.mockResolvedValueOnce({ status: "PAGADO", providerPaymentRef: "mp-1", paidArs: "1000", totalArs: "1000", pagosExtra: ["mp-2"], lastError: null });
    expect(await A.acreditarPagoImpresion("ws", { ...pago({ amountMinor: 50000 }), providerPaymentId: "mp-2" })).toEqual({ ok: true, yaEstaba: true });
    expect(H.caja).not.toHaveBeenCalled();
  });

  it("pagar de más queda anotado y avisa al estudio", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa());
    orden.updateMany.mockResolvedValueOnce({ count: 0 });
    orden.findUnique.mockResolvedValueOnce({ status: "ENVIADO", providerPaymentRef: "mp-1", paidArs: "1000", totalArs: "1000", pagosExtra: null, lastError: null });
    await A.acreditarPagoImpresion("ws", { ...pago({ amountMinor: 100000 }), providerPaymentId: "mp-3" });
    // No pisa lastError (lo usa la preparación): el pago de más se ve porque lo pagado supera el total.
    expect(orden.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { paidArs: "2000.00", pagosExtra: ["mp-3"] } });
    await vi.waitFor(() => expect(H.falla).toHaveBeenCalledWith("ws", 8, "PAGO_DE_MAS", 100000, expect.anything()));
  });

  it("el pago de un pedido reemplazado no sale al laboratorio: queda anotado y avisa al estudio", async () => {
    orden.findUnique.mockResolvedValueOnce(pedidoWa({ status: "CANCELADO", lastError: "REEMPLAZADO" }));
    const r = await A.acreditarPagoImpresion("ws", pago({ amountMinor: 50000 }));
    expect(r).toEqual({ ok: true, yaEstaba: false });
    expect(H.crear).not.toHaveBeenCalled();
    expect(orden.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastError: "PAGADO_REEMPLAZADO", paidArs: "500.00" }) }));
    await vi.waitFor(() => expect(H.falla).toHaveBeenCalled());
    expect(H.whatsapp).not.toHaveBeenCalled();
  });
});
