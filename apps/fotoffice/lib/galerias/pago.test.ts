import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  preferencia: vi.fn(async (..._a: unknown[]) => ({ providerPreferenceId: "pref-1", checkoutUrl: "https://mp.test/checkout" })),
  /** Pagos por dueño del token: `${token}:${id}`. */
  pagos: new Map<string, unknown>(),
  search: vi.fn(async (..._a: unknown[]) => null as unknown),
  collector: vi.fn(async (ws: string) => (ws === "ws-sin-cobros" ? { ok: false } : { ok: true, collector: { accessToken: `tok-${ws}` } })),
  adaptadores: [] as { accessToken?: string }[],
  aviso: vi.fn(async (..._a: unknown[]) => ({ cliente: "ENVIADO", estudio: "ENVIADO" })),
  avisoNoAcreditado: vi.fn(async (..._a: unknown[]) => "ENVIADO"),
  avisoSegundo: vi.fn(async (..._a: unknown[]) => "ENVIADO"),
  avisoDevuelto: vi.fn(async (..._a: unknown[]) => "ENVIADO"),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (f: () => unknown) => void f(), NextResponse: { json: (b: unknown, i?: unknown) => ({ body: b, init: i }) } }));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("./avisos-compra", () => ({ avisarCompraPagada: H.aviso, avisarPagoNoAcreditado: H.avisoNoAcreditado, avisarSegundoPago: H.avisoSegundo, avisarPagoDevuelto: H.avisoDevuelto }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: (opts: { accessToken?: string }) => {
    H.adaptadores.push(opts);
    return {
      createPreference: H.preferencia,
      getPayment: async (id: string) => {
        const p = H.pagos.get(`${opts.accessToken}:${id}`);
        if (!p) throw new Error("no es de esta cuenta");
        return p;
      },
      searchPaymentsByExternalReference: H.search,
    };
  },
}));

const P = await import("./pago");
const A = await import("./acreditar");
const E = await import("./enlace");
const V = await import("./venta-publica");
const PU = await import("./publico");
const { POST: webhookPOST, GET: webhookGET } = await import("../../app/api/payments/mp/galerias-webhook/route");

const CLAVE = "clave-de-prueba";
const EMITIDO = new Date("2026-10-01T10:00:00.000Z");
const tokenDe = (id: string) => E.tokenDeGaleriaCliente(id, EMITIDO, CLAVE);
const TOKEN = tokenDe("gc1");
const compras = () => B.datos.fotofficeGaleriaCompra;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);
const movimientos = () => B.datos.cashMovement;

function galeria(datos: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleria", {
    id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA",
    saleMode: "SELECCION_Y_VENTA", includedCount: 2, pricingMode: "POR_FOTO", unitPriceArs: "1500.00", ...datos,
  });
}
function cliente(id: string, workspaceId = "ws-1", galeriaId = "g1", datos: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaCliente", {
    id, workspaceId, galeriaId, clientId: "cli-1", name: "Lucía", email: "lucia@x.com", tokenHash: E.hashDeToken(tokenDe(id)), tokenIssuedAt: EMITIDO, ...datos,
  });
}
function elegir(fotoId: string, segundo: number, galeriaClienteId = "gc1") {
  B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId, fotoId, createdAt: new Date(2026, 9, 1, 10, 0, segundo) });
}
function compra(id: string, estado: string, fotos: string[], datos: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaCompra", {
    id, workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: estado, extraCount: fotos.length,
    subtotalArs: "4500.00", totalArs: "4500.00", pricingSnapshot: {}, ...datos,
  });
  fotos.forEach((fotoId) => B.agregar("fotofficeGaleriaCompraFoto", { compraId: id, fotoId }));
}
/** Un pago como lo devuelve el adaptador, visible sólo con el token de `ws`. */
function pago(id: string, compraId: string, bruto: number, ws = "ws-1", extra: Record<string, unknown> = {}, raw: Record<string, unknown> = {}) {
  const p = {
    providerPaymentId: id, status: "APPROVED", amountMinor: Math.round(bruto * 100), currency: "ARS",
    externalReference: V.referenciaCompra(compraId),
    rawSanitized: { status: "approved", date_approved: "2026-10-10T14:00:00.000Z", fee_details: [{ type: "mercadopago_fee", amount: 55 }], ...raw },
    ...extra,
  };
  H.pagos.set(`tok-${ws}:${id}`, p);
  return p;
}
const aviso = (id: string, url = "https://app.test/api/payments/mp/galerias-webhook") =>
  new Request(url, { method: "POST", body: JSON.stringify({ type: "payment", data: { id } }), headers: { "content-type": "application/json" } });
const llamar = async (id: string) => ((await webhookPOST(aviso(id))) as unknown as { body: { applied?: boolean; resultado?: string; motivo?: string }; init?: { status?: number } });

let logs: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  B.vaciar();
  H.pagos.clear();
  H.adaptadores.length = 0;
  H.preferencia.mockClear();
  H.aviso.mockClear();
  H.avisoNoAcreditado.mockClear();
  H.avisoSegundo.mockClear();
  H.avisoDevuelto.mockClear();
  H.search.mockReset().mockResolvedValue(null);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  vi.stubEnv("LINK_SECRET", CLAVE);
  logs = [vi.spyOn(console, "warn").mockImplementation(() => {}), vi.spyOn(console, "error").mockImplementation(() => {})];
  B.agregar("cashAccount", { id: "caja-diaria", workspaceId: "ws-1", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, order: 0 });
  B.agregar("cashAccount", { id: "mp", workspaceId: "ws-1", name: "Mercado Pago", kind: "DIGITAL", order: 20 });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  galeria();
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA", saleMode: "SELECCION_Y_VENTA", includedCount: 0, pricingMode: "POR_FOTO", unitPriceArs: "100.00" });
  cliente("gc1");
  cliente("gc-ajeno", "ws-2", "g-ajena");
  ["f1", "f2", "f3", "f4", "f5"].forEach((f, i) => elegir(f, i));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("iniciarPagoGaleria", () => {
  it("crea una compra PENDIENTE con las fotos extra y el precio del servidor, y abre Checkout Pro con el token de la organización", async () => {
    const r = await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect(r).toMatchObject({ ok: true, checkoutUrl: "https://mp.test/checkout" });
    expect(compras()).toHaveLength(1);
    expect(compras()[0]).toMatchObject({ status: "PENDIENTE", extraCount: 3, totalArs: "4500.00", workspaceId: "ws-1", galeriaClienteId: "gc1", mpPreferenceId: "pref-1" });
    expect(B.datos.fotofficeGaleriaCompraFoto.map((f) => f.fotoId).sort()).toEqual(["f3", "f4", "f5"]);
    const id = compras()[0]!.id as string;
    const p = H.preferencia.mock.calls[0]![0] as Record<string, unknown>;
    expect(p).toMatchObject({
      amountMinor: 450_000, currency: "ARS", externalReference: `fo-galcompra:${id}`, accessTokenOverride: "tok-ws-1",
      notificationUrl: "https://app.test/api/payments/mp/galerias-webhook?ws=ws-1", payerEmail: "lucia@x.com",
    });
    expect(p.description).toBe("Fotos extra · Boda");
    expect(p).not.toHaveProperty("marketplaceFee");
    expect(p.successUrl).toBe(`https://app.test/w/dnxestudio/galeria/${TOKEN}?pago=ok&compra=${id}`);
    expect(p.failureUrl).toContain("pago=error");
    expect(p.pendingUrl).toContain("pago=pendiente");
  });

  it("si hay una pendiente con las mismas fotos y total la reutiliza (no arma otra)", async () => {
    await P.iniciarPagoGaleria("ws-1", TOKEN);
    await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect(compras()).toHaveLength(1);
    expect(B.datos.fotofficeGaleriaCompraFoto).toHaveLength(3);
    expect(H.preferencia).toHaveBeenCalledTimes(2);
    expect((H.preferencia.mock.calls[1]![0] as { externalReference: string }).externalReference).toBe(`fo-galcompra:${compras()[0]!.id}`);
  });

  it("si cambiaron las fotos, la vieja pasa a CANCELADA y se arma una nueva", async () => {
    await P.iniciarPagoGaleria("ws-1", TOKEN);
    const vieja = compras()[0]!.id;
    elegir("f6", 30);
    const r = await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect(r.ok).toBe(true);
    expect(compras()).toHaveLength(2);
    expect(compras().find((c) => c.id === vieja)!.status).toBe("CANCELADA");
    expect(compras().find((c) => c.id !== vieja)).toMatchObject({ status: "PENDIENTE", extraCount: 4, totalArs: "6000.00" });
    expect(eventos()).toContain("COMPRA_CANCELADA");
  });

  it("no cobra de nuevo las fotos ya pagadas", async () => {
    compra("c0", "PAGADA", ["f3"], { totalArs: "1500.00", extraCount: 1 });
    await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect((H.preferencia.mock.calls[0]![0] as { amountMinor: number }).amountMinor).toBe(300_000);
    expect(B.datos.fotofficeGaleriaCompraFoto.filter((f) => f.compraId !== "c0").map((f) => f.fotoId).sort()).toEqual(["f4", "f5"]);
  });

  it("sin token válido no hace nada", async () => {
    for (const t of [undefined, "", "x", "a".repeat(43), 42]) {
      const r = await P.iniciarPagoGaleria("ws-1", t);
      expect(r).toMatchObject({ ok: false, codigo: "INVALIDO", error: V.MENSAJES_PAGO_GALERIA.enlaceInvalido });
    }
    expect(compras()).toHaveLength(0);
    expect(H.preferencia).not.toHaveBeenCalled();
  });

  it("el token de un cliente de otra organización o de otra galería no sirve (IDOR)", async () => {
    expect(await P.iniciarPagoGaleria("ws-1", tokenDe("gc-ajeno"))).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(await P.iniciarPagoGaleria("ws-2", TOKEN)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    // Un cliente de otra galería de la misma organización cobra sólo lo suyo.
    galeria({ id: "g2", number: "G-2", name: "Otra" });
    cliente("gc2", "ws-1", "g2");
    elegir("h1", 1, "gc2");
    elegir("h2", 2, "gc2");
    elegir("h3", 3, "gc2");
    const r = await P.iniciarPagoGaleria("ws-1", tokenDe("gc2"));
    expect(r.ok).toBe(true);
    const c = compras()[0]!;
    expect(c).toMatchObject({ galeriaId: "g2", galeriaClienteId: "gc2", extraCount: 1, totalArs: "1500.00" });
    expect(B.datos.fotofficeGaleriaCompraFoto.map((f) => f.fotoId)).toEqual(["h3"]);
  });

  it("una galería que no está publicada o con enlace anulado no abre el pago", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.status = "ARCHIVADA";
    expect(await P.iniciarPagoGaleria("ws-1", TOKEN)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.status = "PUBLICADA";
    B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.revokedAt = new Date();
    expect(await P.iniciarPagoGaleria("ws-1", TOKEN)).toMatchObject({ ok: false, codigo: "INVALIDO" });
  });

  it("sin el token de Mercado Pago de la organización explica que no hay cobros y no crea nada", async () => {
    H.collector.mockResolvedValueOnce({ ok: false } as never);
    const r = await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect(r).toMatchObject({ ok: false, error: "La organización todavía no tiene los cobros habilitados. Escribile para pagar de otra forma." });
    expect(compras()).toHaveLength(0);
  });

  it("sin fotos extra, sin venta o con la selección ya enviada no hay nada que pagar", async () => {
    B.datos.fotofficeGaleriaSeleccion.splice(2);
    expect(await P.iniciarPagoGaleria("ws-1", TOKEN)).toMatchObject({ ok: false, error: V.MENSAJES_PAGO_GALERIA.sinExtras });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.saleMode = "SELECCION";
    expect(await P.iniciarPagoGaleria("ws-1", TOKEN)).toMatchObject({ ok: false, error: V.MENSAJES_PAGO_GALERIA.sinVenta });
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.saleMode = "SELECCION_Y_VENTA";
    B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.status = "EN_REVISION";
    expect(await P.iniciarPagoGaleria("ws-1", TOKEN)).toMatchObject({ ok: false, codigo: "SOLO_LECTURA" });
    expect(compras()).toHaveLength(0);
  });

  it("si Mercado Pago rechaza la preferencia devuelve un mensaje fijo y la compra queda pendiente para reutilizar", async () => {
    H.preferencia.mockRejectedValueOnce(new Error("detalle interno de MP"));
    const r = await P.iniciarPagoGaleria("ws-1", TOKEN);
    expect(r).toEqual({ ok: false, error: V.MENSAJES_PAGO_GALERIA.fallo, codigo: "REGLA" });
    expect(compras()).toHaveLength(1);
    expect((await P.iniciarPagoGaleria("ws-1", TOKEN)).ok).toBe(true);
    expect(compras()).toHaveLength(1);
  });
});

describe("webhook de pagos de galerías", () => {
  beforeEach(() => {
    compra("c1", "PENDIENTE", ["f3", "f4", "f5"]);
  });

  it("acredita un pago aprobado: compra PAGADA, comisión y neto, Caja, eventos y avisos", async () => {
    pago("1001", "c1", 4500);
    const r = await llamar("1001");
    expect(r.body).toMatchObject({ ok: true, applied: true, resultado: "acreditado" });
    expect(compras()[0]).toMatchObject({ status: "PAGADA", providerPaymentRef: "1001", feeArs: "55.00", netArs: "4445.00" });
    expect(compras()[0]!.paidAt).toEqual(new Date("2026-10-10T14:00:00.000Z"));
    expect(movimientos()).toHaveLength(1);
    expect(movimientos()[0]).toMatchObject({ kind: "INGRESO", amountArs: "4500.00", sourceModule: "galerias", sourceRef: "c1", paymentMethod: "MERCADO_PAGO", workspaceId: "ws-1" });
    expect(compras()[0]!.cashMovementId).toBe(movimientos()[0]!.id);
    expect(eventos()).toEqual(["COMPRA_PAGADA"]);
    expect(H.aviso).toHaveBeenCalledTimes(1);
    expect(H.aviso.mock.calls[0]![0]).toMatchObject({ workspaceId: "ws-1", compraId: "c1", sinCaja: false, fotosRepetidas: false });
    expect(H.adaptadores.some((a) => a.accessToken === "tok-ws-1")).toBe(true);
  });

  it("también por GET", async () => {
    pago("1001", "c1", 4500);
    const r = (await webhookGET(new Request("https://app.test/api/payments/mp/galerias-webhook?type=payment&data.id=1001"))) as unknown as { body: { applied: boolean } };
    expect(r.body.applied).toBe(true);
  });

  it("un aviso repetido no acredita dos veces ni deposita dos veces ni avisa dos veces", async () => {
    pago("1001", "c1", 4500);
    await llamar("1001");
    const otra = await llamar("1001");
    expect(otra.body).toMatchObject({ applied: false, motivo: "aviso repetido" });
    expect(movimientos()).toHaveLength(1);
    expect(H.aviso).toHaveBeenCalledTimes(1);
    // Si el atajo no estuviera (compra pagada y otra pendiente), la acreditación igual es idempotente.
    const directo = await A.acreditarPagoGaleria("ws-1", pago("1001", "c1", 4500) as never, { luego: () => undefined });
    expect(directo).toEqual({ resultado: "ya_acreditado", compraId: "c1" });
    expect(movimientos()).toHaveLength(1);
  });

  it("un identificador que Mercado Pago no conoce no hace nada y responde 200", async () => {
    const r = await llamar("999999");
    expect(r.body).toMatchObject({ ok: true, applied: false });
    expect(compras()[0]!.status).toBe("PENDIENTE");
    expect(movimientos()).toHaveLength(0);
  });

  it("sin identificador responde 200 e ignora", async () => {
    const r = (await webhookPOST(new Request("https://app.test/x", { method: "POST", body: "no es json" }))) as unknown as { body: { ignored: string }; init: { status: number } };
    expect(r.init.status).toBe(200);
    expect(r.body.ignored).toBeTruthy();
  });

  it("un cuerpo que no es JSON o una dirección inválida nunca da 500", async () => {
    const mala = { url: "no-es-una-url", json: async () => { throw new Error("x"); } } as unknown as Request;
    const r = (await webhookPOST(mala)) as unknown as { init: { status: number } };
    expect(r.init.status).toBe(200);
  });

  it("un pago de otra cosa (referencia de otro módulo) se ignora", async () => {
    pago("1002", "c1", 4500, "ws-1", { externalReference: "fo-pedcuota:cuota-1" });
    const r = await llamar("1002");
    expect(r.body).toMatchObject({ applied: false, motivo: "no es de una galería" });
    expect(compras()[0]!.status).toBe("PENDIENTE");
    pago("1003", "c1", 4500, "ws-1", { externalReference: null });
    expect((await llamar("1003")).body.applied).toBe(false);
    expect(movimientos()).toHaveLength(0);
  });

  it("un pago de otra organización que nombra una compra nuestra no acredita nada", async () => {
    B.agregar("fotofficeGaleriaCompra", { id: "c-ajena", workspaceId: "ws-2", galeriaId: "g-ajena", galeriaClienteId: "gc-ajeno", status: "PENDIENTE", extraCount: 1, subtotalArs: "100.00", totalArs: "100.00", pricingSnapshot: {} });
    // El pago es de la cuenta de ws-2 pero su referencia dice c1 (de ws-1).
    pago("1004", "c1", 4500, "ws-2");
    const r = await llamar("1004");
    expect(r.body).toMatchObject({ applied: false, resultado: "no_es_de_esta_organizacion" });
    expect(compras().find((c) => c.id === "c1")!.status).toBe("PENDIENTE");
    expect(movimientos()).toHaveLength(0);
    expect(H.aviso).not.toHaveBeenCalled();
  });

  it("un pago de otra organización para una compra de ella sólo acredita en la suya", async () => {
    B.agregar("fotofficeGaleriaCompra", { id: "c-ajena", workspaceId: "ws-2", galeriaId: "g-ajena", galeriaClienteId: "gc-ajeno", status: "PENDIENTE", extraCount: 1, subtotalArs: "100.00", totalArs: "100.00", pricingSnapshot: {} });
    pago("1005", "c-ajena", 100, "ws-2");
    const r = await llamar("1005");
    expect(r.body.applied).toBe(true);
    expect(compras().find((c) => c.id === "c-ajena")!.status).toBe("PAGADA");
    expect(compras().find((c) => c.id === "c1")!.status).toBe("PENDIENTE");
    expect(movimientos().every((m) => m.workspaceId !== "ws-1")).toBe(true);
  });

  it("un importe menor al total no acredita: deja el evento y avisa al estudio una sola vez", async () => {
    pago("1006", "c1", 4499.99);
    const r = await llamar("1006");
    expect(r.body).toMatchObject({ applied: false, resultado: "sin_aplicar" });
    expect(compras()[0]).toMatchObject({ status: "PENDIENTE", providerPaymentRef: null });
    expect(movimientos()).toHaveLength(0);
    expect(eventos()).toEqual(["PAGO_NO_ACREDITADO"]);
    expect(B.datos.fotofficeGaleriaEvento[0]!.data).toMatchObject({ motivo: "IMPORTE_MENOR", pagadoCents: 449_999, totalCents: 450_000 });
    expect(H.avisoNoAcreditado).toHaveBeenCalledTimes(1);
    await llamar("1006");
    expect(eventos()).toEqual(["PAGO_NO_ACREDITADO"]);
    expect(H.avisoNoAcreditado).toHaveBeenCalledTimes(1);
  });

  it("un pago en otra moneda no acredita", async () => {
    pago("1007", "c1", 4500, "ws-1", { currency: "USD" });
    expect((await llamar("1007")).body).toMatchObject({ applied: false, resultado: "sin_aplicar" });
    expect(compras()[0]!.status).toBe("PENDIENTE");
  });

  it("un importe mayor al total acredita (el total de la compra es el que va a Caja)", async () => {
    pago("1008", "c1", 5000);
    expect((await llamar("1008")).body.applied).toBe(true);
    expect(movimientos()[0]!.amountArs).toBe("4500.00");
  });

  it("un pago que no está aprobado no acredita", async () => {
    pago("1009", "c1", 4500, "ws-1", { status: "PENDING" }, { status: "in_process" });
    expect((await llamar("1009")).body).toMatchObject({ applied: false, resultado: "no_aprobado" });
    expect(compras()[0]!.status).toBe("PENDIENTE");
    expect(H.aviso).not.toHaveBeenCalled();
  });

  it("sin Caja la compra queda pagada igual, con el evento y el aviso lo dice", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    pago("1010", "c1", 4500);
    expect((await llamar("1010")).body.applied).toBe(true);
    expect(compras()[0]).toMatchObject({ status: "PAGADA", cashMovementId: null });
    expect(movimientos()).toHaveLength(0);
    expect(eventos()).toEqual(["COMPRA_PAGADA", "COMPRA_SIN_CAJA"]);
    expect(H.aviso.mock.calls[0]![0]).toMatchObject({ sinCaja: true });
  });

  it("una compra cancelada que igual se pagó se acepta: queda pagada, en Caja y con su evento", async () => {
    compras()[0]!.status = "CANCELADA";
    pago("1011", "c1", 4500);
    expect((await llamar("1011")).body.applied).toBe(true);
    expect(compras()[0]!.status).toBe("PAGADA");
    expect(movimientos()).toHaveLength(1);
    expect(eventos()).toEqual(["COMPRA_PAGADA", "COMPRA_CANCELADA_PAGADA"]);
    expect(H.aviso.mock.calls[0]![0]).toMatchObject({ fotosRepetidas: false });
  });

  it("una cancelada con fotos que ya estaban pagas se acredita igual, registra PAGO_DUPLICADO y avisa", async () => {
    compras()[0]!.status = "CANCELADA";
    compra("c0", "PAGADA", ["f4", "f5"], { totalArs: "3000.00", extraCount: 2 });
    pago("1012", "c1", 4500);
    expect((await llamar("1012")).body.applied).toBe(true);
    expect(compras().find((c) => c.id === "c1")!.status).toBe("PAGADA");
    expect(movimientos()).toHaveLength(1);
    expect(eventos()).toContain("PAGO_DUPLICADO");
    expect(B.datos.fotofficeGaleriaEvento.find((e) => e.type === "PAGO_DUPLICADO")!.data).toMatchObject({ compraId: "c1", fotosRepetidas: 2 });
    expect(H.aviso.mock.calls[0]![0]).toMatchObject({ fotosRepetidas: true });
  });

  it("en una galería sólo de venta el pago deja al cliente en revisión", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.saleMode = "VENTA";
    pago("1013", "c1", 4500);
    await llamar("1013");
    expect(B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.status).toBe("EN_REVISION");
  });

  it("el mismo pago no se puede usar en otra compra", async () => {
    compra("c2", "PENDIENTE", ["f1"], { totalArs: "1500.00", extraCount: 1 });
    pago("1014", "c1", 4500);
    await llamar("1014");
    const otra = await A.acreditarPagoGaleria("ws-1", { ...(pago("1014", "c2", 4500) as object) } as never, { luego: () => undefined });
    expect(otra.resultado).toBe("ya_acreditado");
    expect(compras().find((c) => c.id === "c2")!.status).toBe("PENDIENTE");
  });

  it("un segundo pago aprobado por una compra ya paga queda registrado, avisa y no crea otro movimiento de Caja", async () => {
    pago("2001", "c1", 4500);
    await llamar("2001");
    pago("2002", "c1", 4500);
    const r = await llamar("2002");
    expect(r.body).toMatchObject({ applied: false, resultado: "ya_acreditado" });
    expect(movimientos()).toHaveLength(1);
    expect(compras()[0]).toMatchObject({ status: "PAGADA", providerPaymentRef: "2001" });
    const dup = B.datos.fotofficeGaleriaEvento.filter((e) => e.type === "PAGO_DUPLICADO");
    expect(dup).toHaveLength(1);
    expect(dup[0]!.data).toMatchObject({ compraId: "c1", pago: "2002", pagadoCents: 450_000, motivo: "SEGUNDO_PAGO" });
    expect((dup[0]!.data as { fecha: string }).fecha).toBe("2026-10-10T14:00:00.000Z");
    expect(H.avisoSegundo).toHaveBeenCalledTimes(1);
    expect(H.avisoSegundo.mock.calls[0]![0]).toMatchObject({ compraId: "c1", pagadoCents: 450_000 });
  });

  it("un pago de Mercado Pago sobre una compra que el estudio marcó paga a mano también se registra y avisa", async () => {
    compras()[0]!.status = "PAGADA";
    compras()[0]!.providerPaymentRef = null;
    pago("2003", "c1", 4500);
    const r = await llamar("2003");
    expect(r.body).toMatchObject({ applied: false, resultado: "ya_acreditado" });
    expect(movimientos()).toHaveLength(0);
    expect(compras()[0]!.providerPaymentRef).toBeNull();
    expect(eventos()).toEqual(["PAGO_DUPLICADO"]);
    expect(H.avisoSegundo).toHaveBeenCalledTimes(1);
  });

  it("el aviso repetido del segundo pago se registra y avisa una sola vez", async () => {
    pago("2001", "c1", 4500);
    await llamar("2001");
    pago("2002", "c1", 4500);
    await llamar("2002");
    await llamar("2002");
    expect(eventos().filter((t) => t === "PAGO_DUPLICADO")).toHaveLength(1);
    expect(H.avisoSegundo).toHaveBeenCalledTimes(1);
    expect(movimientos()).toHaveLength(1);
  });

  it("el mismo pago que ya acreditó la compra no cuenta como segundo pago", async () => {
    pago("2001", "c1", 4500);
    await llamar("2001");
    await A.acreditarPagoGaleria("ws-1", pago("2001", "c1", 4500) as never, { luego: () => undefined });
    expect(eventos()).not.toContain("PAGO_DUPLICADO");
    expect(H.avisoSegundo).not.toHaveBeenCalled();
  });

  it("no loguea datos personales", async () => {
    pago("1006", "c1", 100);
    await llamar("1006");
    pago("1015", "c1", 4500);
    await llamar("1015");
    const todo = JSON.stringify(logs.flatMap((l) => l.mock.calls));
    expect(todo).not.toMatch(/lucia@x\.com|Lucía/);
  });
});

describe("webhook de galerías: organización por ?ws= y devoluciones", () => {
  beforeEach(() => {
    compra("c1", "PENDIENTE", ["f3", "f4", "f5"]);
  });
  const conWs = async (id: string, ws: string) =>
    ((await webhookPOST(aviso(id, `https://app.test/api/payments/mp/galerias-webhook?ws=${ws}`))) as unknown as { body: Record<string, unknown>; init?: { status?: number } });

  it("con ?ws= lee el pago sólo con el token de esa organización y acredita", async () => {
    pago("3001", "c1", 4500);
    const r = await conWs("3001", "ws-1");
    expect(r.body).toMatchObject({ ok: true, applied: true, resultado: "acreditado" });
    expect(H.adaptadores.map((a) => a.accessToken)).toEqual(["tok-ws-1"]);
  });

  it("un ?ws= equivocado se descarta: ws solo no alcanza si su token no puede leer el pago", async () => {
    pago("3002", "c1", 4500);
    const r = await conWs("3002", "ws-2");
    expect(r.body).toMatchObject({ ok: true, applied: false, motivo: "el pago no es de esa organización" });
    expect(r.init).toBeUndefined();
    expect(compras()[0]!.status).toBe("PENDIENTE");
    expect(H.adaptadores.map((a) => a.accessToken)).toEqual(["tok-ws-2"]);
  });

  it("un ?ws= cuyo token lee un pago que nombra una compra de otra organización no acredita", async () => {
    pago("3003", "c1", 4500, "ws-2");
    expect((await conWs("3003", "ws-2")).body).toMatchObject({ applied: false, resultado: "no_es_de_esta_organizacion" });
    expect(compras()[0]!.status).toBe("PENDIENTE");
  });

  it("sin ?ws= (preferencia vieja) prueba las organizaciones, las más activas primero", async () => {
    for (let i = 0; i < 25; i++) {
      B.agregar("fotofficeGaleriaCompra", { id: `otra-${i}`, workspaceId: `ws-x${i}`, galeriaId: "g-x", galeriaClienteId: "gc-x", status: "PENDIENTE", extraCount: 1, totalArs: "1.00", updatedAt: new Date(2026, 0, 1) });
    }
    compras().find((c) => c.id === "c1")!.updatedAt = new Date(2026, 9, 10);
    pago("3004", "c1", 4500);
    expect((await llamar("3004")).body).toMatchObject({ applied: true });
    expect(H.adaptadores[0]!.accessToken).toBe("tok-ws-1");
  });

  it("una devolución o un contracargo de una compra ya acreditada avisa una vez por estado y no toca Caja", async () => {
    pago("3005", "c1", 4500);
    await llamar("3005");
    expect(movimientos()).toHaveLength(1);
    pago("3005", "c1", 4500, "ws-1", { status: "REFUNDED" }, { status: "refunded", status_detail: "refunded" });
    expect((await llamar("3005")).body).toMatchObject({ applied: false, motivo: "devolución", resultado: "avisado" });
    expect((await llamar("3005")).body).toMatchObject({ resultado: "ya_avisado" });
    expect(H.avisoDevuelto).toHaveBeenCalledTimes(1);
    expect(String((H.avisoDevuelto.mock.calls[0]![0] as { texto: string }).texto)).toMatch(/Mercado Pago devolvió \(o le reclamaron\) el pago N° 3005 de \$ 4\.500,00 \(devuelto\): anulá la compra en Caja si corresponde/);
    pago("3005", "c1", 4500, "ws-1", { status: "CHARGEBACK" }, { status: "charged_back" });
    expect((await llamar("3005")).body).toMatchObject({ resultado: "avisado" });
    expect(H.avisoDevuelto).toHaveBeenCalledTimes(2);
    expect(eventos().filter((e) => e === "PAGO_DEVUELTO")).toHaveLength(2);
    expect(compras()[0]!.status).toBe("PAGADA");
    expect(movimientos()).toHaveLength(1);
  });

  it("la devolución de un segundo pago (registrado en PAGO_DUPLICADO) también avisa, una vez, sin tocar Caja", async () => {
    pago("3101", "c1", 4500);
    await llamar("3101");
    pago("3102", "c1", 4500);
    await llamar("3102");
    expect(eventos()).toContain("PAGO_DUPLICADO");
    pago("3102", "c1", 4500, "ws-1", { status: "REFUNDED" }, { status: "refunded" });
    expect((await llamar("3102")).body).toMatchObject({ applied: false, resultado: "ya_acreditado" });
    await llamar("3102");
    expect(H.avisoDevuelto).toHaveBeenCalledTimes(1);
    expect(String((H.avisoDevuelto.mock.calls[0]![0] as { texto: string }).texto)).toMatch(/pago N° 3102 de \$ 4\.500,00 \(devuelto\): era un segundo pago que no se anotó en Caja/);
    expect(eventos().filter((e) => e === "PAGO_DEVUELTO")).toHaveLength(1);
    expect(movimientos()).toHaveLength(1);
    expect(compras()[0]).toMatchObject({ status: "PAGADA", providerPaymentRef: "3101" });
  });

  it("un pago devuelto que nunca se registró no avisa nada", async () => {
    pago("3103", "c1", 4500, "ws-1", { status: "REFUNDED" }, { status: "refunded" });
    expect((await llamar("3103")).body).toMatchObject({ applied: false, resultado: "no_aprobado" });
    expect(H.avisoDevuelto).not.toHaveBeenCalled();
  });

  it("un aviso repetido de un pago que sigue aprobado no avisa nada", async () => {
    pago("3006", "c1", 4500);
    await llamar("3006");
    expect((await llamar("3006")).body).toMatchObject({ motivo: "aviso repetido" });
    expect(H.avisoDevuelto).not.toHaveBeenCalled();
  });

  it("si la base falla en el camino de la devolución, responde 200 igual", async () => {
    pago("3007", "c1", 4500);
    await llamar("3007");
    const tabla = B.tablas.fotofficeGaleriaCompra as { findFirst: (...a: unknown[]) => Promise<unknown> };
    const original = tabla.findFirst;
    tabla.findFirst = async () => {
      throw new Error("base caída");
    };
    try {
      const r = await llamar("3007");
      expect(r.init?.status).toBe(200);
    } finally {
      tabla.findFirst = original;
    }
  });
});

describe("vuelta del comprador", () => {
  beforeEach(() => {
    compra("c1", "PENDIENTE", ["f3", "f4", "f5"]);
  });

  it("con payment_id aprobado acredita y la página puede mostrar el agradecimiento", async () => {
    pago("2001", "c1", 4500);
    const r = await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "c1", paymentId: "2001" });
    expect(r).toBe("acreditado");
    expect(V.avisoDeVueltaGaleria("ok", r)).toMatchObject({ tono: "ok" });
    expect(await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "c1", paymentId: "2001" })).toBe("ya_acreditado");
    expect(movimientos()).toHaveLength(1);
  });

  it("sin payment_id busca por la referencia de la compra", async () => {
    H.search.mockResolvedValueOnce(pago("2002", "c1", 4500));
    expect(await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "c1", paymentId: null })).toBe("acreditado");
    expect(H.search).toHaveBeenCalledWith("fo-galcompra:c1");
  });

  it("un payment_id inventado o de otra cuenta no acredita ni muestra el agradecimiento", async () => {
    const r = await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "c1", paymentId: "777" });
    expect(r).toBe("no_disponible");
    expect(V.avisoDeVueltaGaleria("ok", r)?.tono).toBe("info");
    expect(compras()[0]!.status).toBe("PENDIENTE");
  });

  it("un pago de OTRA compra no sirve para ésta", async () => {
    compra("c9", "PENDIENTE", ["f1"], { totalArs: "1500.00", extraCount: 1 });
    pago("2003", "c9", 1500);
    expect(await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "c1", paymentId: "2003" })).toBe("sin_pago");
    expect(compras().find((c) => c.id === "c9")!.status).toBe("PENDIENTE");
  });

  it("la compra de otro cliente no se verifica con este token", async () => {
    pago("2004", "c1", 4500);
    expect(await P.verificarVueltaGaleria("ws-2", tokenDe("gc-ajeno"), { compraId: "c1", paymentId: "2004" })).toBe("sin_pago");
    expect(await P.verificarVueltaGaleria("ws-1", tokenDe("gc-ajeno"), { compraId: "c1", paymentId: "2004" })).toBeNull();
    expect(compras()[0]!.status).toBe("PENDIENTE");
  });

  it("datos de la dirección sin forma se descartan", async () => {
    expect(await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: "../x", paymentId: "1" })).toBeNull();
    expect(await P.verificarVueltaGaleria("ws-1", TOKEN, { compraId: undefined, paymentId: "1" })).toBeNull();
  });
});

describe("enviar la selección con fotos extra", () => {
  it("no deja enviar mientras haya extras sin pagar, con un mensaje claro", async () => {
    const r = await PU.enviarSeleccion("ws-1", TOKEN, null);
    expect(r).toMatchObject({ ok: false, error: V.mensajeExtrasSinPagar(3) });
    expect(B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.status).toBe("EN_PROGRESO");
  });

  it("con las extras pagadas sí deja enviar", async () => {
    compra("c0", "PAGADA", ["f3", "f4", "f5"]);
    expect((await PU.enviarSeleccion("ws-1", TOKEN, null)).ok).toBe(true);
  });

  it("en una galería sólo de venta no hay selección para enviar", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.saleMode = "VENTA";
    expect(await PU.enviarSeleccion("ws-1", TOKEN, null)).toMatchObject({ ok: false, error: V.MENSAJE_VENTA_SIN_ENVIO });
  });
});
