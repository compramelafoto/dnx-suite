import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  culturalSaleOrder: { findUnique: vi.fn(), updateMany: vi.fn() },
  culturalWorkOffer: { findUnique: vi.fn() },
  culturalEditionCopy: { findUnique: vi.fn() },
  culturalActivity: { findUnique: vi.fn() },
  culturalSaleSetup: { findUnique: vi.fn() },
  culturalActivityWork: { findUnique: vi.fn() },
  culturalSaleEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const galletas = vi.hoisted(() => ({ valor: new Map<string, string>() }));
const conciliar = vi.hoisted(() => ({ conciliarPedido: vi.fn() }));
const piezas = vi.hoisted(() => ({ pdfGuardado: vi.fn(), archivoFirmado: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (n: string) => (galletas.valor.has(n) ? { value: galletas.valor.get(n) } : undefined) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("./conciliar", () => conciliar);
vi.mock("./certificado", () => ({ pdfGuardado: piezas.pdfGuardado }));
vi.mock("./archivo-firmado", () => ({ archivoFirmado: piezas.archivoFirmado }));

const { default: PaginaDelPedido } = await import("@/app/compras/[publicId]/page");
const { GET: descargarCertificado } = await import("@/app/compras/[publicId]/certificado/route");
const { GET: descargarArchivo } = await import("@/app/compras/[publicId]/archivo/route");
const { default: Arrepentimiento } = await import("@/app/compras/[publicId]/arrepentimiento/page");
const { pedirArrepentimiento } = await import("./arrepentimiento");
const { ARREPENTIMIENTO_RECIBIDO, ARREPENTIMIENTO_VENCIDO } = await import("./pedido-comprador");
const { hashDeToken } = await import("./pedido");
const { proxy } = await import("@/proxy");
const { GET: entrar } = await import("@/app/compras/[publicId]/entrar/route");
const { resetRateLimit } = await import("@/lib/limite");

const ID = "abcd1234abcd1234";
const OTRO = "zzzz9999zzzz9999";
const TOKEN = "t".repeat(43);
const DIA = 86_400_000;
let pedido: Record<string, unknown>;
let copia: Record<string, unknown> | null;

const base = () => ({
  id: "o1", publicId: ID, accessTokenHash: hashDeToken(TOKEN), activityId: "a1", offerId: "of1", copyId: "c1", isTest: false,
  status: "PAID", providerOrderId: "ORD1", lastSyncedAt: new Date(), delivery: "DIGITAL", fulfillment: "NONE", shippingAddress: null,
  priceArs: 80000, shippingArs: 0, totalCents: 8_000_000, paidAt: new Date(Date.now() - DIA), regretRequestedAt: null, trackingText: null,
  readyAt: null, shippedAt: null, deliveredAt: null,
});

/** Todo el texto del árbol (renderiza los componentes de servidor sin hooks). */
function todoDe(n: unknown): string {
  if (n == null || typeof n === "boolean" || typeof n === "function") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(todoDe).join(" ");
  if (typeof n === "object" && "props" in (n as object)) {
    const el = n as { type: unknown; props: Record<string, unknown> };
    if (typeof el.type === "function" && el.type.name === "Pedido") return todoDe((el.type as (p: unknown) => unknown)(el.props));
    return Object.values(el.props).map(todoDe).join(" ");
  }
  return "";
}
const abrir = (t?: string, publicId = ID) => PaginaDelPedido({ params: Promise.resolve({ publicId }), searchParams: Promise.resolve(t ? { t } : {}) });
const req = (url: string) => new Request(url);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  galletas.valor = new Map();
  pedido = base();
  copia = { id: "c1", kind: "COPY", number: 3, status: "ISSUED", orderId: "o1", certificateCode: "ABCD2345EFGH" };
  db.culturalSaleOrder.findUnique.mockImplementation(async ({ where }: { where: { publicId?: string; id?: string } }) =>
    where.publicId === ID || where.id === "o1" ? pedido : where.publicId === OTRO ? { ...base(), id: "o2", publicId: OTRO, accessTokenHash: hashDeToken("x".repeat(43)) } : null);
  db.culturalSaleOrder.updateMany.mockResolvedValue({ count: 1 });
  db.culturalEditionCopy.findUnique.mockImplementation(async () => copia);
  db.culturalWorkOffer.findUnique.mockResolvedValue({ activityWorkId: "w1", format: "DIGITAL", editionKind: "LIMITED", editionSize: 10, proofCount: 0, paper: null, widthCm: null, heightCm: null });
  db.culturalActivity.findUnique.mockResolvedValue({ title: "Silos", slug: "silos", organizersText: "Foto Club", venueName: "Sede", address: null, city: "Rosario", isVirtualOnly: false });
  db.culturalSaleSetup.findUnique.mockResolvedValue({ pickupText: null, shippingText: null });
  db.culturalActivityWork.findUnique.mockResolvedValue({ title: "Río", authorName: "Ema" });
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => unknown) => fn(db));
  piezas.pdfGuardado.mockResolvedValue(new Uint8Array([1, 2, 3]));
  piezas.archivoFirmado.mockResolvedValue({ bytes: Buffer.from([9]), nombre: "Rio-ABCD2345EFGH.jpg" });
  conciliar.conciliarPedido.mockResolvedValue({ estado: "PAID", cambio: true });
});

describe("la página del pedido", () => {
  it("sin token ni cookie: 404", async () => {
    await expect(abrir()).rejects.toThrow("NOT_FOUND");
  });
  it("con el token de otro pedido: 404", async () => {
    await expect(abrir(TOKEN, OTRO)).rejects.toThrow("NOT_FOUND");
    await expect(abrir("x".repeat(43))).rejects.toThrow("NOT_FOUND");
  });
  it("con el token: estado, número, certificado, descargas y el enlace para volver", async () => {
    const t = todoDe(await abrir(TOKEN));
    expect(t).toContain("Pago confirmado");
    expect(t).toContain("Tu copia es la 3/10");
    expect(t).toContain("Descargar certificado (PDF)");
    expect(t).toContain("Descargar archivo firmado");
    expect(t).toContain("Guardá este enlace");
    expect(t).toContain(`/compras/${ID}?t=${TOKEN}`);
    expect(t).toContain("Botón de arrepentimiento");
  });
  it("con la cookie también abre", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    expect(todoDe(await abrir())).toContain("Pago confirmado");
  });
  it("pendiente con Order y sin mirar hace más de 30 s: concilia una vez", async () => {
    pedido = { ...base(), status: "PENDING_PAYMENT", lastSyncedAt: new Date(Date.now() - 60_000) };
    await abrir(TOKEN);
    expect(conciliar.conciliarPedido).toHaveBeenCalledTimes(1);
    expect(conciliar.conciliarPedido).toHaveBeenCalledWith({ publicId: ID }, "RETURN");
    pedido = { ...pedido, lastSyncedAt: new Date() };
    await abrir(TOKEN);
    expect(conciliar.conciliarPedido).toHaveBeenCalledTimes(1);
  });
  it("si la conciliación falla, la página igual se muestra", async () => {
    pedido = { ...base(), status: "PENDING_PAYMENT", lastSyncedAt: null };
    conciliar.conciliarPedido.mockRejectedValue(Object.assign(new Error("token APP_USR-secreto"), { name: "MercadoPagoError" }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(todoDe(await abrir(TOKEN))).toContain("Esperando la confirmación de Mercado Pago");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("APP_USR");
    spy.mockRestore();
  });
});

describe("descargas del comprador", () => {
  it("certificado con la cookie: PDF sin caché", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    const r = await descargarCertificado(req(`https://x/compras/${ID}/certificado`), { params: Promise.resolve({ publicId: ID }) });
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/pdf");
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    expect(r.headers.get("Content-Disposition")).toContain('filename="certificado-ABCD2345EFGH.pdf"');
  });
  it("sin acceso: 404 y nada se genera", async () => {
    const r = await descargarCertificado(req(`https://x/compras/${ID}/certificado`), { params: Promise.resolve({ publicId: ID }) });
    expect(r.status).toBe(404);
    expect(piezas.pdfGuardado).not.toHaveBeenCalled();
  });
  it("con el ?t= y sin la cookie: 404 (las descargas usan sólo la cookie)", async () => {
    const r = await descargarCertificado(req(`https://x/compras/${ID}/certificado?t=${TOKEN}`), { params: Promise.resolve({ publicId: ID }) });
    expect(r.status).toBe(404);
    expect(piezas.pdfGuardado).not.toHaveBeenCalled();
  });
  it("copia anulada: 410", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    pedido = { ...base(), status: "REFUNDED" };
    copia = { ...copia!, status: "VOIDED" };
    const r = await descargarArchivo(req(`https://x/compras/${ID}/archivo?t=${TOKEN}`), { params: Promise.resolve({ publicId: ID }) });
    expect(r.status).toBe(410);
    expect(await r.text()).toBe("Esta copia fue anulada.");
  });
  it("pedido sin pagar o copia sin emitir: no hay descarga", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    pedido = { ...base(), status: "PENDING_PAYMENT" };
    copia = { ...copia!, status: "RESERVED", certificateCode: null };
    const r = await descargarCertificado(req(`https://x/compras/${ID}/certificado?t=${TOKEN}`), { params: Promise.resolve({ publicId: ID }) });
    expect(r.status).toBe(404);
    expect(piezas.pdfGuardado).not.toHaveBeenCalled();
  });
  it("el archivo firmado sólo para la copia digital", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    const ok = await descargarArchivo(req(`https://x/compras/${ID}/archivo?t=${TOKEN}`), { params: Promise.resolve({ publicId: ID }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Disposition")).toContain("Rio-ABCD2345EFGH.jpg");
    db.culturalWorkOffer.findUnique.mockResolvedValue({ format: "PRINT" });
    const no = await descargarArchivo(req(`https://x/compras/${ID}/archivo?t=${TOKEN}`), { params: Promise.resolve({ publicId: ID }) });
    expect(no.status).toBe(404);
  });
});

describe("arrepentimiento", () => {
  const fd = () => {
    const f = new FormData();
    f.set("publicId", ID);
    f.set("motivo", "Me equivoqué de obra");
    return f;
  };
  it("dentro de los 10 días: queda registrado con un evento del comprador", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    expect(await pedirArrepentimiento(null, fd())).toEqual({ ok: true, mensaje: ARREPENTIMIENTO_RECIBIDO });
    expect(db.culturalSaleOrder.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: "o1", regretRequestedAt: null } });
    expect(db.culturalSaleEvent.create.mock.calls[0]![0].data).toMatchObject({ orderId: "o1", source: "BUYER" });
  });
  it("después de 10 días: el mensaje, sin registrar nada", async () => {
    galletas.valor = new Map([[`mf_pedido_${ID}`, TOKEN]]);
    pedido = { ...base(), paidAt: new Date(Date.now() - 11 * DIA) };
    expect(await pedirArrepentimiento(null, fd())).toEqual({ ok: false, error: ARREPENTIMIENTO_VENCIDO });
    expect(db.culturalSaleOrder.updateMany).not.toHaveBeenCalled();
    expect(todoDe(await Arrepentimiento({ params: Promise.resolve({ publicId: ID }) }))).toContain(ARREPENTIMIENTO_VENCIDO);
  });
  it("sin la cookie del pedido no se puede pedir", async () => {
    expect((await pedirArrepentimiento(null, fd())).ok).toBe(false);
    expect(db.culturalSaleOrder.updateMany).not.toHaveBeenCalled();
  });
});

describe("el enlace con ?t=", () => {
  const ctx = (publicId = ID) => ({ params: Promise.resolve({ publicId }) });
  it("el proxy lo manda a /entrar sin tocar la cookie (303)", () => {
    const r = proxy(new NextRequest(`https://muestras.test/compras/${ID}?t=${TOKEN}`));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`https://muestras.test/compras/${ID}/entrar?t=${TOKEN}`);
    expect(r.cookies.get(`mf_pedido_${ID}`)).toBeUndefined();
  });
  it("sin token o con uno sin forma: sigue de largo", () => {
    expect(proxy(new NextRequest(`https://muestras.test/compras/${ID}`)).headers.get("location")).toBeNull();
    expect(proxy(new NextRequest(`https://muestras.test/compras/${ID}?t=<script>`)).headers.get("location")).toBeNull();
  });
  it("/entrar con el token del pedido: lo pasa a la cookie y redirige sin él (303)", async () => {
    const r = await entrar(new NextRequest(`https://muestras.test/compras/${ID}/entrar?t=${TOKEN}`), ctx());
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe(`https://muestras.test/compras/${ID}`);
    expect(r.headers.get("Cache-Control")).toBe("private, no-store");
    const cookie = r.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`mf_pedido_${ID}=${TOKEN}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain(`Path=/compras/${ID}`);
  });
  it("/entrar con un token que no abre el pedido: redirige sin pisar la cookie", async () => {
    for (const [publicId, t] of [[ID, "x".repeat(43)], [OTRO, TOKEN], [ID, "<script>"], ["nada", TOKEN]] as const) {
      const r = await entrar(new NextRequest(`https://muestras.test/compras/${publicId}/entrar?t=${encodeURIComponent(t)}`), ctx(publicId));
      expect(r.status).toBe(303);
      expect(r.headers.get("set-cookie")).toBeNull();
    }
  });
});
