import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalWorkOffer: { findUnique: vi.fn(), findMany: vi.fn() },
  culturalSaleSetup: { findUnique: vi.fn() },
  culturalActivity: { findUnique: vi.fn() },
  culturalActivityWork: { findMany: vi.fn() },
  culturalExhibitorWork: { findMany: vi.fn() },
  culturalContestWork: { findMany: vi.fn() },
  culturalSaleAuthorTerms: { findUnique: vi.fn(), findMany: vi.fn() },
  culturalPayoutAccount: { findMany: vi.fn() },
  culturalSaleFile: { findUnique: vi.fn(), findMany: vi.fn() },
  culturalAuthorSignature: { findUnique: vi.fn(), findMany: vi.fn() },
  culturalEditionCopy: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  culturalSaleOrder: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  culturalSaleEvent: { create: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const cfg = vi.hoisted(() => ({ modo: "TEST" as "OFF" | "TEST" | "LIVE" }));
const galleta = vi.hoisted(() => ({ set: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }), cookies: async () => galleta }));
vi.mock("./modo", () => ({ configVerificada: async () => ({ modo: cfg.modo, ambienteCuenta: "SANDBOX", motivo: null, faltan: [], probadores: new Set([60]) }) }));
vi.mock("./config", () => ({
  leerConfigDeVentas: () => ({ modo: cfg.modo, ambienteCuenta: "SANDBOX", motivo: null, faltan: [], probadores: new Set([60]) }),
  puedeComprar: (u: { id: number; esSuperAdmin: boolean } | null, c: { modo: string; probadores: Set<number> }) =>
    c.modo === "LIVE" || (c.modo === "TEST" && u != null && (u.esSuperAdmin || c.probadores.has(u.id))),
  credencialesDeVentas: () => ({ pedidosSecret: "secreto-de-pedidos-de-prueba", ownerUserId: "999" }),
}));

const { reservarCopia } = await import("./reservar");
const { ofertasDeLaObra } = await import("./comprable");
const { hashDeToken, pedidoConAcceso, tokenDePedido } = await import("./pedido");
const { resetRateLimit } = await import("@/lib/limite");

const ahora = Date.now();
const probador = { id: 60, esSuperAdmin: false, email: "p@x", name: "Probador" };
let oferta: Record<string, unknown>;
let setup: Record<string, unknown>;
let terminos: Record<string, unknown> | null;
let copias: Record<string, unknown>[];
let pedidos: Record<string, Record<string, unknown>>;

const base = () => ({
  id: "of1", activityId: "a1", activityWorkId: "aw1", authorUserId: 50, format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 0,
  priceArs: 100_000, approvedPriceArs: 100_000, paper: "Hahnemühle", widthCm: 40, heightCm: 60, status: "APPROVED", reviewNote: null, firstSoldAt: null,
  sortOrder: 0, proposedAt: null, updatedAt: new Date(),
});
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const compra = (extra: Record<string, string> = {}) =>
  fd({ offerId: "of1", entrega: "PICKUP", nombre: "Bea Compradora", email: "bea@testuser.com", terminos: "on", termsVersion: "2026-10-11", nombreEnCertificado: "on", ...extra });
const envio = { calle: "San Martín", numero: "1234", ciudad: "Rosario", provincia: "Santa Fe", codigoPostal: "2000" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = probador;
  cfg.modo = "TEST";
  oferta = base();
  setup = { id: "s1", activityId: "a1", status: "OPEN", splitVersion: 2, organizerUserId: 7, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000, shippingEnabled: true, shippingCostArs: 5000 };
  terminos = { splitVersion: 2 };
  copias = [];
  pedidos = {};
  db.$queryRaw.mockImplementation(async () => [{ id: "of1" }]);
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.culturalWorkOffer.findUnique.mockImplementation(async () => oferta);
  db.culturalWorkOffer.findMany.mockImplementation(async () => [oferta]);
  db.culturalSaleSetup.findUnique.mockImplementation(async () => setup);
  db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Silos", slug: "silos", reviewStatus: "APPROVED", isCancelled: false, endsAt: new Date(ahora + 10 * 86_400_000), proposedByUserId: 7, type: "MUESTRA" });
  db.culturalExhibitorWork.findMany.mockResolvedValue([{ activityWorkId: "aw1", priceArs: 90_000, exhibitor: { userId: 50 } }]);
  db.culturalContestWork.findMany.mockResolvedValue([]);
  db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw1", title: "Silos", imageUrl: "https://pub/x.webp", authorName: "Ana", sortOrder: 0 }]);
  db.culturalSaleAuthorTerms.findUnique.mockImplementation(async () => terminos);
  db.culturalSaleAuthorTerms.findMany.mockImplementation(async () => (terminos ? [{ userId: 50, ...terminos, acceptedAt: new Date() }] : []));
  db.culturalPayoutAccount.findMany.mockResolvedValue([
    { userId: 7, consentStatus: "ACTIVE", receiverId: "r-org", mpEmail: "org@mp" },
    { userId: 50, consentStatus: "ACTIVE", receiverId: "r-foto", mpEmail: "ana@mp" },
  ]);
  db.culturalSaleFile.findUnique.mockResolvedValue({ status: "READY" });
  db.culturalSaleFile.findMany.mockResolvedValue([{ activityWorkId: "aw1", status: "READY" }]);
  db.culturalAuthorSignature.findUnique.mockResolvedValue({ userId: 50 });
  db.culturalAuthorSignature.findMany.mockResolvedValue([{ userId: 50 }]);
  db.culturalEditionCopy.findMany.mockImplementation(async (q: { where: { status?: string; reservedUntil?: { lte: Date } } }) =>
    q.where.status === "RESERVED"
      ? copias.filter((c) => c.status === "RESERVED" && (c.reservedUntil as Date).getTime() <= q.where.reservedUntil!.lte.getTime())
      : copias);
  db.culturalEditionCopy.create.mockImplementation(async (q: { data: Record<string, unknown> }) => {
    const c = { id: `c${copias.length + 1}`, ...q.data };
    copias.push(c);
    return { id: c.id };
  });
  db.culturalEditionCopy.update.mockImplementation(async (q: { where: { id: string }; data: Record<string, unknown> }) => {
    const c = copias.find((x) => x.id === q.where.id)!;
    Object.assign(c, q.data);
    return c;
  });
  db.culturalEditionCopy.updateMany.mockImplementation(async (q: { where: { id: string }; data: Record<string, unknown> }) => {
    const c = copias.find((x) => x.id === q.where.id);
    if (!c) return { count: 0 };
    Object.assign(c, q.data);
    return { count: 1 };
  });
  db.culturalSaleOrder.findUnique.mockImplementation(async (q: { where: { id?: string; publicId?: string } }) =>
    Object.values(pedidos).find((p) => p.id === q.where.id || p.publicId === q.where.publicId) ?? null);
  db.culturalSaleOrder.create.mockImplementation(async (q: { data: Record<string, unknown> }) => {
    const p = { id: `o${Object.keys(pedidos).length + 1}`, createdAt: new Date(), ...q.data };
    pedidos[p.id] = p;
    return { id: p.id };
  });
  db.culturalSaleOrder.updateMany.mockImplementation(async (q: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
    const hits = Object.values(pedidos).filter((p) =>
      (q.where.id === undefined || p.id === q.where.id) && (q.where.copyId === undefined || p.copyId === q.where.copyId) &&
      (q.where.status === undefined || p.status === q.where.status));
    for (const p of hits) Object.assign(p, q.data);
    return { count: hits.length };
  });
  db.culturalSaleEvent.create.mockResolvedValue({});
});

describe("reservarCopia", () => {
  it("con la venta apagada → todavía no disponible", async () => {
    cfg.modo = "OFF";
    expect(await reservarCopia(compra())).toEqual({ ok: false, errores: ["La venta de esta obra todavía no está disponible."] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("en prueba, alguien que no es probador no compra", async () => {
    usuarioActual.valor = null;
    expect(await reservarCopia(compra())).toEqual({ ok: false, errores: ["La venta de esta obra todavía no está disponible."] });
  });

  it("en prueba, el email del comprador tiene que ser de prueba", async () => {
    expect(await reservarCopia(compra({ email: "bea@gmail.com" }))).toEqual({ ok: false, errores: ["En modo prueba usá un email de comprador de prueba (termina en @testuser.com)."] });
  });

  it("términos viejos → pide recargar", async () => {
    expect(await reservarCopia(compra({ termsVersion: "2020-01-01" }))).toEqual({ ok: false, errores: ["Los términos de la venta cambiaron: recargá la página y revisalos."] });
  });

  it("envío no habilitado → mensaje", async () => {
    setup.shippingEnabled = false;
    expect(await reservarCopia(compra({ entrega: "SHIPPING", ...envio }))).toEqual({ ok: false, errores: ["Esta muestra no hace envíos: elegí retirarla en la sede."] });
    expect(db.culturalSaleOrder.create).not.toHaveBeenCalled();
  });

  it("sin copias libres → se vendieron todas", async () => {
    copias = Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, number: i + 1, status: "ISSUED", reservedUntil: null, kind: "COPY", isTest: true }));
    expect(await reservarCopia(compra())).toEqual({ ok: false, errores: ["Se vendieron todas las copias de este formato."] });
  });

  it("si el autor no aceptó el reparto vigente, no se compra", async () => {
    terminos = { splitVersion: 1 };
    expect(await reservarCopia(compra())).toEqual({ ok: false, errores: ["Esta obra no se puede comprar ahora."] });
  });

  it("crea el pedido con los montos y la foto del reparto (el envío va a la organización)", async () => {
    const r = await reservarCopia(compra({ entrega: "SHIPPING", ...envio }));
    expect(r).toMatchObject({ ok: true, totalArs: 105_000 });
    const { publicId, token } = r as { publicId: string; token: string };
    expect(publicId).toMatch(/^[a-z0-9]{16}$/);
    expect(db.$queryRaw).toHaveBeenCalled();
    const p = db.culturalSaleOrder.create.mock.calls[0]![0].data;
    expect(p).toMatchObject({
      publicId, isTest: true, offerId: "of1", activityId: "a1", copyId: "c1", buyerName: "Bea Compradora", buyerEmail: "bea@testuser.com", buyerOnCertificate: true,
      delivery: "SHIPPING", priceArs: 100_000, shippingArs: 5000, totalCents: 10_500_000, platformCents: 1_500_000, organizerCents: 2_500_000,
      photographerCents: 6_000_000, status: "PENDING_PAYMENT", fulfillment: "PENDING", externalReference: `muestras-venta-${publicId}`, termsVersion: "2026-10-11",
      accessTokenHash: hashDeToken(token),
      splitSnapshot: {
        v: 1, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000, splitVersion: 2, environment: "SANDBOX", ownerUserId: "999",
        organizer: { userId: 7, receiverId: "r-org" }, photographer: { userId: 50, receiverId: "r-foto" }, ownerCents: 1_500_000,
        partners: [
          { recipientId: "organizer", receiverId: "r-org", cents: 3_000_000 },
          { recipientId: "photographer", receiverId: "r-foto", cents: 6_000_000 },
        ],
      },
    });
    expect(p.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(p)).not.toContain(token);
    expect(copias[0]).toMatchObject({ number: 1, status: "RESERVED", isTest: true, orderId: "o1" });
    expect(db.culturalSaleEvent.create.mock.calls[0]![0].data).toMatchObject({ orderId: "o1", source: "CREATE", toStatus: "PENDING_PAYMENT" });
    expect(galleta.set).toHaveBeenCalledWith(expect.objectContaining({ name: `mf_pedido_${publicId}`, value: token, httpOnly: true, path: `/compras/${publicId}` }));
  });

  it("una reserva vencida sin orden de Mercado Pago se libera: el pedido vence, suelta la copia y el número se reutiliza", async () => {
    copias = [{ id: "c9", offerId: "of1", number: 1, status: "RESERVED", reservedUntil: new Date(ahora - 60_000), kind: "COPY", isTest: true, orderId: "o-viejo" }];
    pedidos["o-viejo"] = { id: "o-viejo", status: "PENDING_PAYMENT", providerOrderId: null, copyId: "c9", createdAt: new Date(ahora - 30 * 60_000) };
    const r = await reservarCopia(compra());
    expect(r.ok).toBe(true);
    expect(pedidos["o-viejo"]).toMatchObject({ status: "EXPIRED", copyId: null });
    expect(db.culturalSaleEvent.create.mock.calls[0]![0].data).toMatchObject({ orderId: "o-viejo", source: "SWEEP", toStatus: "EXPIRED" });
    expect(copias).toHaveLength(1);
    const nuevo = db.culturalSaleOrder.create.mock.results[0]!.value as Promise<{ id: string }>;
    expect(copias[0]).toMatchObject({ id: "c9", number: 1, status: "RESERVED", orderId: (await nuevo).id });
    expect(db.culturalSaleOrder.create.mock.calls[0]![0].data.copyId).toBe("c9");
  });

  it("una reserva vencida con Order en Mercado Pago (menos de 72 h) no se libera ni se reutiliza", async () => {
    copias = [{ id: "c9", offerId: "of1", number: 1, status: "RESERVED", reservedUntil: new Date(ahora - 60_000), kind: "COPY", isTest: true, orderId: "o-viejo" }];
    pedidos["o-viejo"] = { id: "o-viejo", status: "PENDING_PAYMENT", providerOrderId: "ORD1", copyId: "c9", createdAt: new Date(ahora - 30 * 60_000) };
    await reservarCopia(compra());
    expect(pedidos["o-viejo"]).toMatchObject({ status: "PENDING_PAYMENT", copyId: "c9" });
    expect(copias.find((c) => c.id === "c9")).toMatchObject({ status: "RESERVED", orderId: "o-viejo" });
    expect(db.culturalSaleOrder.create.mock.calls[0]![0].data.copyId).toBe("c2");
  });

  it("pasadas las 72 horas sin confirmar, el pedido con Order vence, suelta la copia y el número se reutiliza", async () => {
    copias = [{ id: "c9", offerId: "of1", number: 1, status: "RESERVED", reservedUntil: new Date(ahora - 60_000), kind: "COPY", isTest: true, orderId: "o-viejo" }];
    pedidos["o-viejo"] = { id: "o-viejo", status: "PENDING_PAYMENT", providerOrderId: "ORD1", copyId: "c9", createdAt: new Date(ahora - 73 * 3_600_000) };
    await reservarCopia(compra());
    expect(pedidos["o-viejo"]).toMatchObject({ status: "EXPIRED", copyId: null });
    expect(db.culturalSaleEvent.create.mock.calls[0]![0].data).toMatchObject({ orderId: "o-viejo", toStatus: "EXPIRED" });
    expect(db.culturalSaleOrder.create.mock.calls[0]![0].data.copyId).toBe("c9");
  });

  it("una copia reservada de un pedido pagado nunca se suelta (la emisión puede venir después)", async () => {
    copias = [{ id: "c9", offerId: "of1", number: 1, status: "RESERVED", reservedUntil: new Date(ahora - 60_000), kind: "COPY", isTest: true, orderId: "o-pago" }];
    pedidos["o-pago"] = { id: "o-pago", status: "PAID", providerOrderId: "ORD1", copyId: "c9", createdAt: new Date(ahora - 30 * 60_000) };
    await reservarCopia(compra());
    expect(pedidos["o-pago"]).toMatchObject({ status: "PAID", copyId: "c9" });
    expect(copias.find((c) => c.id === "c9")).toMatchObject({ status: "RESERVED", orderId: "o-pago" });
    expect(db.culturalSaleOrder.create.mock.calls[0]![0].data.copyId).toBe("c2");
  });

  it("si dos compras llegan juntas al mismo número, la base lo frena y se avisa", async () => {
    db.culturalEditionCopy.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    expect(await reservarCopia(compra())).toEqual({ ok: false, errores: ["Alguien acaba de reservar esa copia: probá de nuevo."] });
  });
});

describe("ofertasDeLaObra", () => {
  it("cada formato con su precio aprobado, cuántas quedan y sus faltas", async () => {
    terminos = null;
    const r = await ofertasDeLaObra("a1", "aw1", { modo: "TEST", ambienteCuenta: "SANDBOX" });
    expect(r).toEqual([
      expect.objectContaining({ id: "of1", priceArs: 100_000, quedan: 10, comprable: { ok: false, reasons: ["Ana todavía no aceptó el reparto"] } }),
    ]);
  });
  it("todo en regla → se puede comprar", async () => {
    const r = await ofertasDeLaObra("a1", "aw1", { modo: "TEST", ambienteCuenta: "SANDBOX" });
    expect(r[0]!.comprable).toEqual({ ok: true });
  });
  it("con la venta apagada nada se compra", async () => {
    const r = await ofertasDeLaObra("a1", "aw1", { modo: "OFF", ambienteCuenta: "SANDBOX" });
    expect(r[0]!.comprable.ok).toBe(false);
  });
  it("un formato en borrador no aparece", async () => {
    oferta.status = "DRAFT";
    expect(await ofertasDeLaObra("a1", "aw1", { modo: "TEST", ambienteCuenta: "SANDBOX" })).toEqual([]);
  });
});

describe("acceso al pedido", () => {
  const pid = "abcd1234abcd1234";
  const token = tokenDePedido(pid, "secreto-de-pedidos-de-prueba");
  beforeEach(() => {
    pedidos = { o1: { id: "o1", publicId: pid, accessTokenHash: hashDeToken(token) } };
  });
  it("con el token del enlace o de la cookie abre", async () => {
    expect(await pedidoConAcceso(pid, { token })).toMatchObject({ id: "o1" });
    expect(await pedidoConAcceso(pid, { cookie: token })).toMatchObject({ id: "o1" });
  });
  it("un token alterado no abre", async () => {
    expect(await pedidoConAcceso(pid, { token: `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}` })).toBeNull();
  });
  it("el token de otro pedido no abre", async () => {
    expect(await pedidoConAcceso(pid, { token: tokenDePedido("zzzz1234abcd1234", "secreto-de-pedidos-de-prueba") })).toBeNull();
  });
  it("un id raro ni consulta", async () => {
    expect(await pedidoConAcceso("../x", { token })).toBeNull();
    expect(db.culturalSaleOrder.findUnique).not.toHaveBeenCalled();
  });
});
