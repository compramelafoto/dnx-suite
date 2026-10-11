import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalSaleOrder: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  culturalSaleEvent: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  culturalEditionCopy: { findMany: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() },
  culturalWorkOffer: { findMany: vi.fn() },
  culturalActivityWork: { findMany: vi.fn(), findUnique: vi.fn() },
  culturalSaleFile: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const mp = vi.hoisted(() => ({ devolverTotal: vi.fn() }));
const conciliar = vi.hoisted(() => ({ conciliarPedido: vi.fn() }));
const r2 = vi.hoisted(() => ({ borrarPrivado: vi.fn(), streamPrivado: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./mp", () => mp);
vi.mock("./conciliar", () => conciliar);
vi.mock("./r2-privado", () => r2);
vi.mock("./certificado", () => ({ pdfGuardado: vi.fn(async () => new Uint8Array([1])) }));

const { borrarVentasDePrueba, cambiarProduccion, devolverPago, pedirDevolucion } = await import("./pedidos-panel");
const { pedidosDeLaMuestra, ventasDelAutor } = await import("./pedidos-consultas");
const { descargarOriginal } = await import("./descarga-panel");
const { resetRateLimit } = await import("@/lib/limite");

const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const coorg = { id: 8, esSuperAdmin: false, email: "c@x", name: "Coorg" };
const textos = { id: 9, esSuperAdmin: false, email: "t@x", name: "Textos" };
const admin = { id: 1, esSuperAdmin: true, email: "a@x", name: "Admin" };
const autor = { id: 50, esSuperAdmin: false, email: "f@x", name: "Foto" };
let pedido: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = dueno;
  pedido = {
    id: "o1", publicId: "abcd1234abcd1234", activityId: "a1", status: "PAID", delivery: "PICKUP", fulfillment: "PENDING", providerOrderId: "ORD1",
    refundRequestedAt: null, isTest: false,
  };
  db.culturalActivity.findUnique.mockImplementation(async () => {
    const u = usuarioActual.valor!;
    const roles: Record<number, string> = { 8: "CO_ORGANIZER", 9: "TEXT_EDITOR" };
    return { proposedByUserId: 7, members: roles[u.id] ? [{ userId: u.id, role: roles[u.id], status: "ACTIVE" }] : [], id: "a1", title: "Silos", type: "MUESTRA" };
  });
  db.culturalSaleOrder.findUnique.mockImplementation(async () => pedido);
  db.culturalSaleOrder.updateMany.mockResolvedValue({ count: 1 });
  db.culturalSaleOrder.findMany.mockResolvedValue([]);
  db.culturalSaleOrder.count.mockResolvedValue(0);
  db.culturalSaleEvent.findMany.mockResolvedValue([]);
  db.culturalEditionCopy.findMany.mockResolvedValue([]);
  db.culturalWorkOffer.findMany.mockResolvedValue([]);
  db.culturalActivityWork.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => unknown) => fn(db));
  mp.devolverTotal.mockResolvedValue({ ok: true, orderStatus: "refunded" });
  conciliar.conciliarPedido.mockResolvedValue({ estado: "REFUNDED", cambio: true });
  r2.borrarPrivado.mockResolvedValue(undefined);
});

describe("producción", () => {
  it("la coorganización avanza la producción con su fecha y un evento del equipo", async () => {
    usuarioActual.valor = coorg;
    expect(await cambiarProduccion("o1", "IN_PRODUCTION")).toEqual({ ok: true });
    expect(db.culturalSaleOrder.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: "o1", status: "PAID", fulfillment: "PENDING" }, data: { fulfillment: "IN_PRODUCTION" } });
    expect(db.culturalSaleEvent.create.mock.calls[0]![0].data).toMatchObject({ source: "STAFF", actorUserId: 8 });
    pedido = { ...pedido, fulfillment: "IN_PRODUCTION" };
    await cambiarProduccion("o1", "READY", "Retirar de martes a viernes");
    expect(db.culturalSaleOrder.updateMany.mock.calls[1]![0].data).toMatchObject({ fulfillment: "READY", trackingText: "Retirar de martes a viernes" });
    expect(db.culturalSaleOrder.updateMany.mock.calls[1]![0].data.readyAt).toBeInstanceOf(Date);
  });
  it("un salto inválido (o un envío en un retiro) → mensaje, sin tocar nada", async () => {
    expect(await cambiarProduccion("o1", "DELIVERED")).toEqual({ ok: false, error: "Ese paso no corresponde ahora." });
    expect(await cambiarProduccion("o1", "SHIPPED")).toEqual({ ok: false, error: "Ese paso no corresponde ahora." });
    expect(db.culturalSaleOrder.updateMany).not.toHaveBeenCalled();
  });
  it("textos y curaduría no toca pedidos ni los ve", async () => {
    usuarioActual.valor = textos;
    expect(await cambiarProduccion("o1", "IN_PRODUCTION")).toEqual({ ok: false, error: "Ese pedido no existe." });
    expect(await pedidosDeLaMuestra("a1", textos)).toBeNull();
  });
});

describe("devoluciones", () => {
  it("la coorganización no pide devoluciones; el dueño sí, con motivo", async () => {
    usuarioActual.valor = coorg;
    expect(await pedirDevolucion("o1", "No llegó")).toEqual({ ok: false, error: "Ese pedido no existe." });
    usuarioActual.valor = dueno;
    expect((await pedirDevolucion("o1", "No llegó")).ok).toBe(true);
    expect(db.culturalSaleOrder.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: "o1", refundRequestedAt: null } });
  });
  it("devolver el pago: sólo el super admin", async () => {
    usuarioActual.valor = dueno;
    expect(await devolverPago("o1", "Arrepentimiento")).toEqual({ ok: false, error: "Ese pedido no existe." });
    expect(mp.devolverTotal).not.toHaveBeenCalled();
  });
  it("dos clics son una sola devolución: la clave de idempotencia es fija por pedido", async () => {
    usuarioActual.valor = admin;
    expect(await devolverPago("o1", "Arrepentimiento")).toEqual({ ok: true, aviso: "Pago devuelto: la copia quedó anulada." });
    await devolverPago("o1", "Arrepentimiento");
    expect(mp.devolverTotal.mock.calls).toEqual([["ORD1", "refund-o1"], ["ORD1", "refund-o1"]]);
    expect(conciliar.conciliarPedido).toHaveBeenCalledWith({ publicId: "abcd1234abcd1234" }, "ADMIN");
  });
  it("si Mercado Pago rechaza: el mensaje, sin conciliar", async () => {
    usuarioActual.valor = admin;
    mp.devolverTotal.mockResolvedValue({ ok: false, error: "Mercado Pago no aceptó la devolución. Probá de nuevo en unos minutos." });
    expect(await devolverPago("o1", "x")).toEqual({ ok: false, error: "Mercado Pago no aceptó la devolución. Probá de nuevo en unos minutos." });
    expect(conciliar.conciliarPedido).not.toHaveBeenCalled();
  });
  it("un pedido sin pagar no se devuelve", async () => {
    usuarioActual.valor = admin;
    pedido = { ...pedido, status: "PENDING_PAYMENT" };
    expect((await devolverPago("o1", "x")).ok).toBe(false);
    expect(mp.devolverTotal).not.toHaveBeenCalled();
  });
});

describe("ventas de prueba", () => {
  it("borrar las pruebas: sólo filas isTest y sólo el super admin", async () => {
    usuarioActual.valor = dueno;
    expect((await borrarVentasDePrueba("a1")).ok).toBe(false);
    usuarioActual.valor = admin;
    db.culturalSaleOrder.findMany.mockResolvedValue([{ id: "t1" }]);
    db.culturalEditionCopy.findMany.mockResolvedValue([{ id: "c1", orderId: "t1", certificateCode: "ABC" }, { id: "p1", orderId: null, certificateCode: null }]);
    expect((await borrarVentasDePrueba("a1")).ok).toBe(true);
    expect(db.culturalSaleOrder.findMany.mock.calls[0]![0].where).toEqual({ activityId: "a1", isTest: true });
    expect(db.culturalSaleOrder.deleteMany.mock.calls[0]![0].where).toEqual({ id: { in: ["t1"] }, isTest: true });
    expect(db.culturalEditionCopy.deleteMany.mock.calls[0]![0].where).toEqual({ activityId: "a1", isTest: true });
    expect(r2.borrarPrivado.mock.calls.map((c) => c[0]).sort()).toEqual(
      ["ventas/pa-p1/certificado.pdf", "ventas/pa-p1/etiqueta.pdf", "ventas/t1/ABC.jpg", "ventas/t1/certificado.pdf", "ventas/t1/etiqueta.pdf"].sort(),
    );
  });
});

describe("lo que ve cada uno", () => {
  it("'Tus ventas' del autor: sin email ni teléfono del comprador, y el nombre sólo si aceptó figurar", async () => {
    db.culturalWorkOffer.findMany.mockResolvedValue([{ id: "of1", activityWorkId: "w1", format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 0 }]);
    db.culturalSaleOrder.findMany.mockResolvedValue([
      { id: "o1", offerId: "of1", copyId: "c1", isTest: false, status: "PAID", paidAt: new Date(), photographerCents: 6_000_000, buyerName: "Bea", buyerOnCertificate: true },
      { id: "o2", offerId: "of1", copyId: null, isTest: false, status: "PAID", paidAt: new Date(), photographerCents: 6_000_000, buyerName: "Oculto", buyerOnCertificate: false },
    ]);
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "w1", title: "Río" }]);
    db.culturalEditionCopy.findMany.mockResolvedValue([{ id: "c1", kind: "COPY", number: 3 }]);
    const v = await ventasDelAutor("a1", autor);
    expect(db.culturalWorkOffer.findMany.mock.calls[0]![0].where).toEqual({ activityId: "a1", authorUserId: 50 });
    const sel = db.culturalSaleOrder.findMany.mock.calls[0]![0].select;
    expect(sel).not.toHaveProperty("buyerEmail");
    expect(sel).not.toHaveProperty("buyerPhone");
    expect(sel).not.toHaveProperty("shippingAddress");
    expect(v.map((x) => x.comprador)).toEqual(["Bea", null]);
    expect(v[0]!.numero).toBe("3/10");
    expect(JSON.stringify(v)).not.toContain("Oculto");
  });
  it("el original para imprimir: otra cuenta recibe 404 sin leer el bucket", async () => {
    db.culturalSaleFile.findUnique.mockResolvedValue({ activityId: "a1", authorUserId: 50, storageKey: "originales/w1.jpg", status: "READY", mime: "image/jpeg" });
    usuarioActual.valor = { id: 99, esSuperAdmin: false, email: "o@x", name: "Otra" };
    expect((await descargarOriginal("w1")).status).toBe(404);
    usuarioActual.valor = textos;
    expect((await descargarOriginal("w1")).status).toBe(404);
    expect(r2.streamPrivado).not.toHaveBeenCalled();
    usuarioActual.valor = coorg;
    r2.streamPrivado.mockResolvedValue({ stream: new ReadableStream(), bytes: 3, contentType: "image/jpeg" });
    db.culturalActivityWork.findUnique.mockResolvedValue({ title: "Río del sur" });
    const r = await descargarOriginal("w1");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Disposition")).toContain('filename="original-Rio-del-sur.jpg"');
  });
});
