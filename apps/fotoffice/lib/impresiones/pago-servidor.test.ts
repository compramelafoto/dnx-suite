import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  preferencia: vi.fn(async (..._a: unknown[]) => ({ providerPreferenceId: "pref-1", checkoutUrl: "https://mp.test/checkout" })),
  collector: vi.fn(async (..._a: unknown[]) => ({ ok: true, collector: { accessToken: "tok" } }) as unknown),
  oferta: vi.fn(),
  fuente: vi.fn(),
  db: {
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(H.db)),
    $executeRaw: vi.fn(),
    fotofficeWorkspaceBranding: { findUnique: vi.fn(async (..._a: unknown[]) => ({ publicSlug: "dnxestudio" }) as unknown) },
    fotofficePrintOrder: {
      aggregate: vi.fn(async () => ({ _max: { number: 7 } })),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "ord1", ...data })),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: H.db, Prisma: { JsonNull: null } }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("@repo/payments/mercado-pago", () => ({ createMercadoPagoCheckoutProLiveAdapter: () => ({ createPreference: H.preferencia }) }));
vi.mock("./configuracion-servidor", () => ({ ofertaPublica: H.oferta }));
vi.mock("./fuentes-servidor", () => ({ resolverFuente: H.fuente }));
process.env.NEXT_PUBLIC_APP_URL = "https://app.test/";
const P = await import("./pago-servidor");

const R = { x: 0, y: 0, w: 1, h: 1 };
const datos = { carrito: { papel: "BRILLO", lineas: [{ archivoId: "a1", sizeId: "t10", quantity: 2, recorte: R }] }, nombre: "Juan", email: "juan@test.com", telefono: "" };
const TOKEN = "token-largo-0000000";

beforeEach(() => {
  vi.clearAllMocks();
  H.collector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
  H.db.fotofficeWorkspaceBranding.findUnique.mockResolvedValue({ publicSlug: "dnxestudio" });
  H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }], envio: null });
  H.fuente.mockResolvedValue({
    tipo: "CARPETA", proyectoOrigenId: "p1", galeriaId: null, clientId: "c1", nombre: null, email: null, telefono: null,
    fotos: [{ id: "a1", nombre: "a.jpg", key: "k", width: 6000, height: 4000, mini: "/mini/a1" }],
  });
});

describe("iniciarPagoImpresion", () => {
  it("crea el pedido con el total del servidor y la preferencia con la cuenta del estudio", async () => {
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, datos);
    expect(r).toEqual({ ok: true, checkoutUrl: "https://mp.test/checkout", pedidoId: "ord1" });
    const creado = H.db.fotofficePrintOrder.create.mock.calls[0][0].data as Record<string, unknown> & { items: { create: Record<string, unknown>[] }; trackingToken: string };
    expect(creado.number).toBe(8);
    expect(String(creado.totalArs)).toBe("1000.00");
    expect(String(creado.costTotalArs)).toBe("400.00");
    expect(creado).toMatchObject({ workspaceId: "ws", source: "CARPETA", proyectoOrigenId: "p1", galeriaId: null, clientId: "c1", nombre: "Juan", email: "juan@test.com", telefono: null, paper: "BRILLO" });
    expect(creado).toMatchObject({ delivery: "RETIRO", shippingArs: "0", subtotalArs: "1000.00" });
    expect(creado.shippingAddress).toBeUndefined();
    expect(H.fuente).toHaveBeenCalledWith("ws", "dnxestudio", "CARPETA", TOKEN);
    expect(creado.items.create[0]).toMatchObject({ archivoId: "a1", sourceKey: "k", sourceName: "a.jpg", quantity: 2, unitPriceArs: "500.00", cropW: 1, proveedorId: "f" });
    const pref = H.preferencia.mock.calls[0][0] as Record<string, unknown>;
    expect(pref).toMatchObject({ amountMinor: 100000, currency: "ARS", externalReference: "fo-impresion:ord1", accessTokenOverride: "tok", payerEmail: "juan@test.com" });
    expect(pref.successUrl).toBe(`https://app.test/w/dnxestudio/impresion/${creado.trackingToken}?pago=ok&pedido=ord1`);
    expect(pref.notificationUrl).toBe("https://app.test/api/payments/mp/impresiones-webhook?ws=ws");
    expect(H.db.fotofficePrintOrder.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { mpPreferenceId: "pref-1" } });
  });
  it("el precio que manda el navegador no cuenta", async () => {
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, { ...datos, carrito: { ...datos.carrito, lineas: [{ ...datos.carrito.lineas[0], unitPriceCents: 1 }] }, totalCents: 1 });
    expect(r.ok).toBe(true);
    expect((H.preferencia.mock.calls[0][0] as { amountMinor: number }).amountMinor).toBe(100000);
  });
  it("sin oferta (módulo apagado) no cobra", async () => {
    H.oferta.mockResolvedValue(null);
    expect((await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, datos)).ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("enlace vencido o de laboratorio no cobra", async () => {
    H.fuente.mockResolvedValue(null);
    expect(await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, datos)).toEqual({ ok: false, error: "Este enlace ya no permite pedir copias." });
  });
  it("una foto que no es de la carpeta no cobra", async () => {
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, { ...datos, carrito: { papel: "BRILLO", lineas: [{ ...datos.carrito.lineas[0], archivoId: "ajena" }] } });
    expect(r.ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("correo inválido no cobra", async () => {
    expect((await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, { ...datos, email: "x" })).ok).toBe(false);
  });
  it("sin nombre no cobra", async () => {
    expect(await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, { ...datos, nombre: "  " })).toEqual({ ok: false, error: "Escribí tu nombre." });
  });
  it("sin Mercado Pago conectado avisa", async () => {
    H.collector.mockResolvedValue({ ok: false });
    expect(await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, datos)).toEqual({ ok: false, error: "El estudio todavía no puede cobrar online. Escribile para hacer el pedido." });
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("desde una galería: el pedido guarda la galería y cada copia la foto de la galería y su original", async () => {
    H.fuente.mockResolvedValue({
      tipo: "GALERIA", proyectoOrigenId: "pr1", galeriaId: "g1", clientId: null, nombre: "Ana", email: "ana@x.com", telefono: "341",
      fotos: [{ id: "a1", nombre: "a.jpg", key: "o/a1", width: 6000, height: 4000, mini: "https://r2.test/t/a1" }],
    });
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "GALERIA", TOKEN, datos);
    expect(r.ok).toBe(true);
    expect(H.fuente).toHaveBeenCalledWith("ws", "dnxestudio", "GALERIA", TOKEN);
    const creado = H.db.fotofficePrintOrder.create.mock.calls[0][0].data as Record<string, unknown> & { items: { create: Record<string, unknown>[] } };
    expect(creado).toMatchObject({ source: "GALERIA", galeriaId: "g1", proyectoOrigenId: "pr1", clientId: null });
    expect(creado.items.create[0]).toMatchObject({ galeriaFotoId: "a1", sourceKey: "o/a1", sourceName: "a.jpg" });
    expect(creado.items.create[0].archivoId).toBeUndefined();
  });
  it("desde una galería: una foto que no está entre las imprimibles (sin pagar) no cobra", async () => {
    H.fuente.mockResolvedValue({ tipo: "GALERIA", proyectoOrigenId: "pr1", galeriaId: "g1", clientId: null, nombre: null, email: null, telefono: null, fotos: [{ id: "pagada", nombre: "p.jpg", key: "o/p", width: 1, height: 1, mini: "" }] });
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "GALERIA", TOKEN, datos);
    expect(r.ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("si Mercado Pago rechaza la preferencia, avisa sin lanzar", async () => {
    H.preferencia.mockRejectedValueOnce(new Error("caído"));
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, datos);
    expect(r.ok).toBe(false);
  });
});

describe("iniciarPagoImpresion · envío a domicilio", () => {
  const ESTUDIO = { lat: -32.9476, lon: -60.6305 };
  const FUNES = { lat: -32.9167, lon: -60.8097 };
  const envio = { baseCents: 100000, porKmCents: 50000, maxKm: 40, estudio: ESTUDIO };
  const conEnvio = (entrega: unknown) => ({ ...datos, entrega });
  const ENTREGA = { tipo: "ENVIO", direccion: "  Av. Siempreviva 742, Funes  ", lat: FUNES.lat, lon: FUNES.lon };
  const creado = () => H.db.fotofficePrintOrder.create.mock.calls[0][0].data as Record<string, unknown>;
  beforeEach(() => {
    H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }], envio });
  });

  it("recalcula el envío en el servidor: total = copias + envío, y Mercado Pago cobra el total", async () => {
    const { cotizarEnvio } = await import("./envio");
    const esperado = cotizarEnvio({ estudio: ESTUDIO, destino: FUNES, baseCents: 100000, porKmCents: 50000, maxKm: 40 });
    if (!esperado.ok) throw new Error("debería cotizar");
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio(ENTREGA));
    expect(r.ok).toBe(true);
    const total = 100000 + esperado.cents;
    expect(creado()).toMatchObject({
      delivery: "ENVIO",
      subtotalArs: "1000.00",
      shippingArs: (esperado.cents / 100).toFixed(2),
      totalArs: (total / 100).toFixed(2),
      shippingAddress: "Av. Siempreviva 742, Funes",
      shippingLat: FUNES.lat,
      shippingLon: FUNES.lon,
      shippingKm: esperado.km,
    });
    expect((H.preferencia.mock.calls[0][0] as { amountMinor: number }).amountMinor).toBe(total);
  });
  it("el monto o los km de envío que manda el navegador no cuentan", async () => {
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio({ ...ENTREGA, cents: 1, km: 0, shippingArs: "1" }));
    expect(r.ok).toBe(true);
    expect(Number(creado().shippingArs)).toBeGreaterThan(1000);
    expect(creado().shippingKm).toBeGreaterThan(20);
  });
  it("fuera de radio se rechaza sin crear el pedido", async () => {
    H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }], envio: { ...envio, maxKm: 5 } });
    expect(await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio(ENTREGA))).toEqual({
      ok: false,
      error: "Esa dirección está fuera de la zona de envío. Elegí retirar en el local.",
    });
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("el estudio sin envío (oferta sin envío) no acepta ENVIO", async () => {
    H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }], envio: null });
    const r = await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio(ENTREGA));
    expect(r.ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("coordenadas imposibles, sin dirección o dirección demasiado larga se rechazan", async () => {
    for (const mala of [
      { ...ENTREGA, lat: 95 },
      { ...ENTREGA, lon: -181 },
      { ...ENTREGA, lat: "-32.9" },
      { ...ENTREGA, lat: Number.NaN },
      { ...ENTREGA, direccion: "   " },
      { ...ENTREGA, direccion: "x".repeat(301) },
      { tipo: "OTRO" },
    ]) {
      expect((await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio(mala))).ok).toBe(false);
    }
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("RETIRO (o sin entrega) no cobra envío aunque el estudio lo ofrezca", async () => {
    await P.iniciarPagoImpresion("ws", "dnxestudio", "CARPETA", TOKEN, conEnvio({ tipo: "RETIRO", direccion: "x", lat: 1, lon: 1 }));
    expect(creado()).toMatchObject({ delivery: "RETIRO", shippingArs: "0", totalArs: "1000.00" });
    expect(creado().shippingAddress).toBeUndefined();
    expect((H.preferencia.mock.calls[0][0] as { amountMinor: number }).amountMinor).toBe(100000);
  });
});

describe("referencias", () => {
  it("ida y vuelta", () => {
    expect(P.pedidoDeReferencia(P.referenciaPedido("abc"))).toBe("abc");
    expect(P.pedidoDeReferencia("fo-galcompra:abc")).toBeNull();
    expect(P.pedidoDeReferencia("fo-impresion:")).toBeNull();
    expect(P.pedidoDeReferencia(42)).toBeNull();
  });
});
