import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  preferencia: vi.fn(async (..._a: unknown[]) => ({ providerPreferenceId: "pref-1", checkoutUrl: "https://mp.test/checkout" })),
  collector: vi.fn(async (..._a: unknown[]) => ({ ok: true, collector: { accessToken: "tok" } }) as unknown),
  oferta: vi.fn(),
  proyecto: vi.fn(),
  fotos: vi.fn(),
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
vi.mock("./fuentes-servidor", () => ({ proyectoDeTokenCliente: H.proyecto, fotosAptas: H.fotos }));
process.env.NEXT_PUBLIC_APP_URL = "https://app.test/";
const P = await import("./pago-servidor");

const R = { x: 0, y: 0, w: 1, h: 1 };
const datos = { carrito: { papel: "BRILLO", lineas: [{ archivoId: "a1", sizeId: "t10", quantity: 2, recorte: R }] }, nombre: "Juan", email: "juan@test.com", telefono: "" };
const TOKEN = "token-largo-0000000";

beforeEach(() => {
  vi.clearAllMocks();
  H.collector.mockResolvedValue({ ok: true, collector: { accessToken: "tok" } });
  H.db.fotofficeWorkspaceBranding.findUnique.mockResolvedValue({ publicSlug: "dnxestudio" });
  H.oferta.mockResolvedValue({ papeles: ["BRILLO"], tamanos: [{ id: "t10", widthCm: 10, heightCm: 15, proveedorId: "f", priceCents: 50000, costCents: 20000 }] });
  H.proyecto.mockResolvedValue({ proyectoId: "p1", clientId: "c1", vence: null });
  H.fotos.mockResolvedValue([{ archivoId: "a1", nombre: "a.jpg", key: "k", width: 6000, height: 4000 }]);
});

describe("iniciarPagoImpresion", () => {
  it("crea el pedido con el total del servidor y la preferencia con la cuenta del estudio", async () => {
    const r = await P.iniciarPagoImpresion("ws", TOKEN, datos);
    expect(r).toEqual({ ok: true, checkoutUrl: "https://mp.test/checkout", pedidoId: "ord1" });
    const creado = H.db.fotofficePrintOrder.create.mock.calls[0][0].data as Record<string, unknown> & { items: { create: Record<string, unknown>[] }; trackingToken: string };
    expect(creado.number).toBe(8);
    expect(String(creado.totalArs)).toBe("1000.00");
    expect(String(creado.costTotalArs)).toBe("400.00");
    expect(creado).toMatchObject({ workspaceId: "ws", proyectoOrigenId: "p1", clientId: "c1", nombre: "Juan", email: "juan@test.com", telefono: null, paper: "BRILLO" });
    expect(creado.items.create[0]).toMatchObject({ archivoId: "a1", sourceKey: "k", sourceName: "a.jpg", quantity: 2, unitPriceArs: "500.00", cropW: 1, proveedorId: "f" });
    const pref = H.preferencia.mock.calls[0][0] as Record<string, unknown>;
    expect(pref).toMatchObject({ amountMinor: 100000, currency: "ARS", externalReference: "fo-impresion:ord1", accessTokenOverride: "tok", payerEmail: "juan@test.com" });
    expect(pref.successUrl).toBe(`https://app.test/w/dnxestudio/impresion/${creado.trackingToken}?pago=ok&pedido=ord1`);
    expect(pref.notificationUrl).toBe("https://app.test/api/payments/mp/impresiones-webhook?ws=ws");
    expect(H.db.fotofficePrintOrder.update).toHaveBeenCalledWith({ where: { id: "ord1" }, data: { mpPreferenceId: "pref-1" } });
  });
  it("el precio que manda el navegador no cuenta", async () => {
    const r = await P.iniciarPagoImpresion("ws", TOKEN, { ...datos, carrito: { ...datos.carrito, lineas: [{ ...datos.carrito.lineas[0], unitPriceCents: 1 }] }, totalCents: 1 });
    expect(r.ok).toBe(true);
    expect((H.preferencia.mock.calls[0][0] as { amountMinor: number }).amountMinor).toBe(100000);
  });
  it("sin oferta (módulo apagado) no cobra", async () => {
    H.oferta.mockResolvedValue(null);
    expect((await P.iniciarPagoImpresion("ws", TOKEN, datos)).ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("enlace vencido o de laboratorio no cobra", async () => {
    H.proyecto.mockResolvedValue(null);
    expect(await P.iniciarPagoImpresion("ws", TOKEN, datos)).toEqual({ ok: false, error: "Este enlace ya no permite pedir copias." });
  });
  it("una foto que no es de la carpeta no cobra", async () => {
    const r = await P.iniciarPagoImpresion("ws", TOKEN, { ...datos, carrito: { papel: "BRILLO", lineas: [{ ...datos.carrito.lineas[0], archivoId: "ajena" }] } });
    expect(r.ok).toBe(false);
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("correo inválido no cobra", async () => {
    expect((await P.iniciarPagoImpresion("ws", TOKEN, { ...datos, email: "x" })).ok).toBe(false);
  });
  it("sin nombre no cobra", async () => {
    expect(await P.iniciarPagoImpresion("ws", TOKEN, { ...datos, nombre: "  " })).toEqual({ ok: false, error: "Escribí tu nombre." });
  });
  it("sin Mercado Pago conectado avisa", async () => {
    H.collector.mockResolvedValue({ ok: false });
    expect(await P.iniciarPagoImpresion("ws", TOKEN, datos)).toEqual({ ok: false, error: "El estudio todavía no puede cobrar online. Escribile para hacer el pedido." });
    expect(H.db.fotofficePrintOrder.create).not.toHaveBeenCalled();
  });
  it("si Mercado Pago rechaza la preferencia, avisa sin lanzar", async () => {
    H.preferencia.mockRejectedValueOnce(new Error("caído"));
    const r = await P.iniciarPagoImpresion("ws", TOKEN, datos);
    expect(r.ok).toBe(false);
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
