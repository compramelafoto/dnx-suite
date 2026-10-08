import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  notificar: vi.fn(async (..._a: unknown[]) => ({ movido: true })),
  recibo: vi.fn(async (..._a: unknown[]) => "ENVIADA"),
  preferencia: vi.fn(async (..._a: unknown[]) => ({ providerPreferenceId: "pref-1", checkoutUrl: "https://mp.test/checkout" })),
  pagos: new Map<string, unknown>(),
  getPayment: vi.fn(async (id: string) => {
    const p = H.pagos.get(id);
    if (!p) throw new Error("no es de esta cuenta");
    return p;
  }),
  search: vi.fn(async (..._a: unknown[]) => null as unknown),
  collector: vi.fn(async (ws: string) => (ws === "ws-sin-cobros" ? { ok: false } : { ok: true, collector: { accessToken: `tok-${ws}` } })),
  adaptadores: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: (f: () => unknown) => void f(), NextResponse: { json: (b: unknown, i?: unknown) => ({ body: b, init: i }) } }));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
}));
vi.mock("./recibos", () => ({ enviarReciboAutomatico: H.recibo }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: (opts: unknown) => {
    H.adaptadores.push(opts);
    return { createPreference: H.preferencia, getPayment: H.getPayment, searchPaymentsByExternalReference: H.search };
  },
}));

const MP = await import("./mp");
const PURO = await import("./mp-puro");
const CO = await import("./cobros");
const { POST: webhookPOST } = await import("../../app/api/payments/mp/pedidos-webhook/route");

const CLAVE = "clave-de-prueba";
const AHORA = new Date("2026-10-07T15:00:00.000Z");

function pedido(id: string, cuotas: [string, number][], datos: Record<string, unknown> = {}) {
  const total = cuotas.reduce((s, [, i]) => s + i, 0);
  B.agregar("fotofficePedido", {
    id, workspaceId: "ws-1", number: `2026-000${B.datos.fotofficePedido.length + 1}`, clientId: "cli-1", status: "CONFIRMADO",
    items: [], totals: {}, totalArs: total.toFixed(2), incomeCategoryId: "rubro-bodas", consultaLeadId: "lead-1", ownerUserId: 7, ...datos,
  });
  cuotas.forEach(([dueDate, importe], i) =>
    B.agregar("fotofficePedidoCuota", {
      id: `${id}-c${i + 1}`, workspaceId: "ws-1", pedidoId: id, position: i + 1,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`), amountArs: importe.toFixed(2),
    }),
  );
}

/** Un pago como lo devuelve el adaptador. */
function pago(id: string, cuotaId: string, bruto: number, extra: Record<string, unknown> = {}, raw: Record<string, unknown> = {}) {
  return {
    providerPaymentId: id, status: "APPROVED", amountMinor: Math.round(bruto * 100), currency: "ARS",
    externalReference: PURO.referenciaCuota(cuotaId),
    rawSanitized: { status: "approved", date_approved: "2026-10-07T14:00:00.000Z", fee_details: [{ type: "mercadopago_fee", amount: 5.5 }], ...raw },
    ...extra,
  };
}

const imputaciones = (cobroId: string) => B.datos.fotofficeCobroImputacion.filter((i) => i.cobroId === cobroId).map((i) => [i.cuotaId, i.amountArs]);
const tareas = () => B.datos.fotofficeTask;

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.pagos.clear();
  H.notificar.mockClear();
  H.recibo.mockClear();
  H.preferencia.mockClear();
  H.getPayment.mockClear();
  H.adaptadores.length = 0;
  process.env.APP_URL = "https://app.test";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.test";
  process.env.PRESUPUESTO_TOKEN_SECRET = CLAVE;
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null, email: "laura@example.com" });
  B.agregar("cashCategory", { id: "rubro-bodas", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO" });
  B.agregar("cashAccount", { id: "caja-diaria", workspaceId: "ws-1", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, order: 0 });
  B.agregar("cashAccount", { id: "mp", workspaceId: "ws-1", name: "Mercado Pago", kind: "DIGITAL", order: 20 });
  B.agregar("cashShift", { id: "turno-1", workspaceId: "ws-1", accountId: "caja-diaria", status: "ABIERTO" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER", createdAt: new Date("2026-01-01") });
  pedido("ped-1", [["2026-10-07", 40000], ["2026-11-07", 40000], ["2026-12-07", 40000]]);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
  avisos = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  const todo = JSON.stringify([errores.mock.calls, avisos.mock.calls]);
  expect(todo).not.toMatch(/Laura|Pérez|laura@example/);
  errores.mockRestore();
  avisos.mockRestore();
});

describe("lo puro", () => {
  it("la referencia de la cuota va y vuelve; lo ajeno se ignora", () => {
    expect(PURO.referenciaCuota("abc")).toBe("fo-pedcuota:abc");
    expect(PURO.cuotaDeReferencia("fo-pedcuota:abc")).toBe("abc");
    expect(PURO.cuotaDeReferencia("store:abc")).toBeNull();
    expect(PURO.cuotaDeReferencia("fo-pedcuota:")).toBeNull();
    expect(PURO.cuotaDeReferencia(null)).toBeNull();
    expect(PURO.cuotaDeReferencia(42)).toBeNull();
  });

  it("hechos del pago: id, monto, fecha y comisión de Mercado Pago en centavos", () => {
    const h = PURO.hechosDelPago(pago("99", "c", 1000.1, {}, { fee_details: [{ type: "mercadopago_fee", amount: 40.7 }, { type: "financing_fee", amount: 3 }, { type: "mercadopago_fee", amount: 0.1 }] }));
    expect(h).toMatchObject({ providerPaymentId: "99", amountMinor: 100010, currency: "ARS", feeMinor: 4080 });
    expect(h.paidAt?.toISOString()).toBe("2026-10-07T14:00:00.000Z");
  });

  it("sin fee_details, o ilegible, o mayor que el pago: la comisión es null", () => {
    const f = (raw: Record<string, unknown>) => PURO.hechosDelPago(pago("1", "c", 100, {}, raw)).feeMinor;
    expect(f({ fee_details: undefined })).toBeNull();
    expect(f({ fee_details: [] })).toBeNull();
    expect(f({ fee_details: [{ type: "financing_fee", amount: 3 }] })).toBeNull();
    expect(f({ fee_details: [{ type: "mercadopago_fee", amount: "5" }] })).toBeNull();
    expect(f({ fee_details: [{ type: "mercadopago_fee", amount: -1 }] })).toBeNull();
    expect(f({ fee_details: [{ type: "mercadopago_fee", amount: 101 }] })).toBeNull();
    expect(f({ fee_details: "x" })).toBeNull();
  });

  it("la fecha ilegible es null", () => {
    expect(PURO.hechosDelPago(pago("1", "c", 1, {}, { date_approved: "no" })).paidAt).toBeNull();
    expect(PURO.hechosDelPago(pago("1", "c", 1, {}, { date_approved: null })).paidAt).toBeNull();
  });
});

describe("acreditar un pago aprobado", () => {
  it("acredita una vez: cobro del Sistema, MERCADO_PAGO, comisión y neto, Caja por el bruto, recibo y EN_CURSO", async () => {
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(r).toEqual({ resultado: "acreditado", pedidoId: "ped-1" });
    const c = B.datos.fotofficeCobro[0]!;
    expect(c).toMatchObject({
      method: "MERCADO_PAGO", amountArs: "40000.00", feeArs: "5.50", netArs: "39994.50", providerPaymentRef: "pay-1",
      createdByUserId: null, receiptNumber: "2026-0001", paidAt: new Date("2026-10-07T14:00:00.000Z"),
    });
    expect(imputaciones(c.id as string)).toEqual([["ped-1-c1", "40000.00"]]);
    expect(B.datos.cashMovement).toHaveLength(1);
    expect(B.datos.cashMovement[0]).toMatchObject({ kind: "INGRESO", amountArs: "40000.00", accountId: "mp", createdByUserId: null, sourceRef: c.id });
    expect(B.datos.fotofficePedido[0]!.status).toBe("EN_CURSO");
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "SENA_COBRADA", c.id);
    expect(H.recibo).toHaveBeenCalledWith("ws-1", c.id);
    expect(tareas()).toHaveLength(0);
  });

  it("sin fee_details, comisión y neto quedan null", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, { fee_details: [] }));
    expect(B.datos.fotofficeCobro[0]).toMatchObject({ feeArs: null, netArs: null });
  });

  it("el mismo aviso repetido no acredita dos veces", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    const otra = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(otra).toEqual({ resultado: "ya_acreditado", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect(B.datos.cashMovement).toHaveLength(1);
    expect(H.recibo).toHaveBeenCalledTimes(1);
    expect(H.notificar).toHaveBeenCalledTimes(1);
  });

  it("la carrera (P2002 en el único de providerPaymentRef) se trata como ya acreditado", async () => {
    // Otro aviso del mismo pago confirmó entre la lectura y la escritura.
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    const tabla = B.tablas.fotofficeCobro as { findFirst: (...a: unknown[]) => Promise<unknown> };
    const original = tabla.findFirst;
    let ciegas = 2; // la lectura de afuera y la de adentro de la transacción no la ven
    tabla.findFirst = async (...a: unknown[]) => {
      const w = (a[0] as { where?: Record<string, unknown> })?.where;
      if (ciegas > 0 && w?.providerPaymentRef) {
        ciegas--;
        return null;
      }
      return original.apply(tabla, a);
    };
    try {
      const r = await CO.registrarCobroDelSistema({
        workspaceId: "ws-1", pedidoId: "ped-1", importe: 40000, paidAt: null, cuotaPreferidaId: null,
        providerPaymentRef: "pay-1", feeArs: null, netArs: null,
      }, { clave: CLAVE, ahora: () => AHORA });
      expect(r).toMatchObject({ ok: true, creado: false });
    } finally {
      tabla.findFirst = original;
    }
    expect(B.datos.fotofficeCobro).toHaveLength(1);
  });

  it("imputa primero a la cuota de la referencia y el resto de la más vieja a la más nueva", async () => {
    // Paga 50.000 por la cuota 2 (40.000): 40.000 a la 2 y 10.000 a la 1 (la más vieja).
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c2", 50000));
    const c = B.datos.fotofficeCobro[0]!;
    expect(imputaciones(c.id as string)).toEqual([["ped-1-c2", "40000.00"], ["ped-1-c1", "10000.00"]]);
  });

  it("un pago parcial de la cuota preferida va sólo a ella", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c3", 15000));
    expect(imputaciones(B.datos.fotofficeCobro[0]!.id as string)).toEqual([["ped-1-c3", "15000.00"]]);
  });

  it("un pago que no está aprobado no acredita", async () => {
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, { status: "PENDING" }, { status: "pending" }));
    expect(r).toEqual({ resultado: "no_aprobado" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("pago que supera el saldo del pedido: no acredita, no crea saldo negativo y deja la tarea", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 120000)); // paga todo
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-2", "ped-1-c1", 40000)); // pago doble
    expect(r).toEqual({ resultado: "sin_aplicar", motivo: "EXCEDE", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect(B.datos.cashMovement).toHaveLength(1);
    expect(tareas()).toHaveLength(1);
    expect(tareas()[0]).toMatchObject({ workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "lead-1", title: PURO.TITULO_TAREA_PAGO_SIN_APLICAR, assigneeUserId: 7 });
  });

  it("un pago de más que el saldo de una cuota pero repartible, se acredita; el aviso repetido de un pago sin aplicar no duplica la tarea", async () => {
    const r1 = await MP.acreditarPagoMp("ws-1", pago("pay-9", "ped-1-c1", 999999));
    const r2 = await MP.acreditarPagoMp("ws-1", pago("pay-9", "ped-1-c1", 999999));
    expect(r1).toMatchObject({ resultado: "sin_aplicar", motivo: "EXCEDE" });
    expect(r2).toMatchObject({ resultado: "sin_aplicar", motivo: "EXCEDE" });
    expect(tareas()).toHaveLength(1);
  });

  it("pedido cancelado: no acredita y deja la tarea", async () => {
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(r).toEqual({ resultado: "sin_aplicar", motivo: "CANCELADO", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
    expect(B.datos.cashMovement).toHaveLength(0);
    expect(tareas()).toHaveLength(1);
  });

  it("sin Caja o sin cuenta: no acredita, avisa con la misma tarea y no lanza", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect(await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000))).toMatchObject({ resultado: "sin_aplicar", motivo: "SIN_CAJA" });
    B.datos.workspaceFeatureModule[0]!.enabled = true;
    for (const a of B.datos.cashAccount) a.isActive = false;
    expect(await MP.acreditarPagoMp("ws-1", pago("pay-2", "ped-1-c1", 40000))).toMatchObject({ resultado: "sin_aplicar", motivo: "SIN_CUENTA" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
    expect(tareas()).toHaveLength(1);
  });

  it("sin consulta, no hay tarea: sólo un aviso en el registro, sin datos personales", async () => {
    B.datos.fotofficePedido[0]!.consultaLeadId = null;
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(r).toMatchObject({ resultado: "sin_aplicar", motivo: "CANCELADO" });
    expect(tareas()).toHaveLength(0);
    expect(avisos).toHaveBeenCalled();
  });

  it("otra moneda no se imputa", async () => {
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, { currency: "USD" }));
    expect(r).toMatchObject({ resultado: "sin_aplicar", motivo: "DATOS" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("una cuota de otra organización no se acredita con el token de ésta", async () => {
    B.datos.fotofficePedido[0]!.workspaceId = "ws-2";
    B.datos.fotofficePedidoCuota.forEach((c) => (c.workspaceId = "ws-2"));
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(r).toEqual({ resultado: "no_es_de_esta_organizacion" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("una referencia que no es de un pedido se ignora", async () => {
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "x", 1, { externalReference: "store:abc" }));
    expect(r).toEqual({ resultado: "no_es_de_esta_organizacion" });
  });
});

describe("iniciar el pago de una cuota", () => {
  it("abre la preferencia por el saldo, sin comisión de plataforma, con la vuelta al pedido con su token", async () => {
    const r = await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c2" });
    expect(r).toEqual({ ok: true, checkoutUrl: "https://mp.test/checkout" });
    const arg = H.preferencia.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      amountMinor: 4000000, currency: "ARS", externalReference: "fo-pedcuota:ped-1-c2", accessTokenOverride: "tok-ws-1",
      notificationUrl: "https://app.test/api/payments/mp/pedidos-webhook", payerEmail: "laura@example.com",
    });
    expect(arg).not.toHaveProperty("marketplaceFeeMinor");
    expect(String(arg.successUrl)).toMatch(/^https:\/\/app\.test\/w\/dnxestudio\/pedido\/[^/?]+\?pago=ok&cuota=ped-1-c2$/);
    expect(String(arg.failureUrl)).toContain("pago=error");
    expect(JSON.stringify(arg.metadata)).not.toMatch(/Laura/);
  });

  it("cobra el saldo que queda de una cuota parcialmente paga", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 15000));
    await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" });
    expect((H.preferencia.mock.calls[0]![0] as { amountMinor: number }).amountMinor).toBe(2500000);
  });

  it("rechaza: saldo 0, pedido cancelado, cuota ajena y organización sin cobros", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" })).toEqual({ ok: false, error: MP.MENSAJES_PAGO_CUOTA.sinSaldo });
    pedido("ped-2", [["2026-10-07", 1000]]);
    expect(await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-2-c1" })).toEqual({ ok: false, error: MP.MENSAJES_PAGO_CUOTA.noExiste });
    expect(await MP.iniciarPagoCuota({ workspaceId: "ws-2", pedidoId: "ped-1", cuotaId: "ped-1-c2" })).toEqual({ ok: false, error: MP.MENSAJES_PAGO_CUOTA.noExiste });
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    expect(await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c2" })).toEqual({ ok: false, error: MP.MENSAJES_PAGO_CUOTA.cancelado });
    B.datos.fotofficePedido[0]!.status = "CONFIRMADO";
    B.datos.fotofficePedido.push({ ...B.datos.fotofficePedido[1]!, id: "ped-x", workspaceId: "ws-sin-cobros" });
    B.datos.fotofficePedidoCuota.push({ id: "x-c1", workspaceId: "ws-sin-cobros", pedidoId: "ped-x", position: 1, dueDate: new Date("2026-10-07T00:00:00.000Z"), amountArs: "1000.00" });
    expect(await MP.iniciarPagoCuota({ workspaceId: "ws-sin-cobros", pedidoId: "ped-x", cuotaId: "x-c1" })).toEqual({ ok: false, error: MP.MENSAJES_PAGO_CUOTA.sinCobros });
    expect(H.preferencia).not.toHaveBeenCalled();
  });
});

describe("la vuelta del comprador", () => {
  it("lee el pago con el token de la organización y lo acredita; no se cree la dirección", async () => {
    H.pagos.set("pay-1", pago("pay-1", "ped-1-c1", 40000));
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1", providerPaymentId: "pay-1" })).toEqual({ resultado: "acreditado" });
    expect(H.adaptadores).toContainEqual({ accessToken: "tok-ws-1" });
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1", providerPaymentId: "pay-1" })).toEqual({ resultado: "ya_acreditado" });
  });

  it("un payment_id de otra cuota o inexistente no acredita", async () => {
    H.pagos.set("pay-2", pago("pay-2", "ped-1-c2", 40000));
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1", providerPaymentId: "pay-2" })).toEqual({ resultado: "sin_pago" });
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1", providerPaymentId: "inventado" })).toEqual({ resultado: "no_disponible" });
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" })).toEqual({ resultado: "sin_pago" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("una cuota que no es del pedido no consulta nada", async () => {
    pedido("ped-2", [["2026-10-07", 1000]]);
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-2-c1", providerPaymentId: "pay-1" })).toEqual({ resultado: "sin_pago" });
    expect(H.getPayment).not.toHaveBeenCalled();
  });
});

describe("el aviso (webhook)", () => {
  const aviso = (id: string | null) =>
    webhookPOST(new Request(`https://app.test/api/payments/mp/pedidos-webhook${id ? `?type=payment&data.id=${id}` : ""}`, { method: "POST", body: JSON.stringify(id ? { data: { id }, type: "payment" } : {}) })) as unknown as Promise<{ body: Record<string, unknown>; init?: { status?: number } }>;

  it("acredita lo que Mercado Pago confirma, sin confiar en el cuerpo, y responde 200", async () => {
    H.pagos.set("777", pago("777", "ped-1-c1", 40000));
    const r = await aviso("777");
    expect(r.body).toMatchObject({ ok: true, applied: true });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect((await aviso("777")).body).toMatchObject({ ok: true, applied: false, motivo: "aviso repetido" });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
  });

  it("el cuerpo no manda: un aviso con importe y referencia inventados no acredita si Mercado Pago no lo respalda", async () => {
    const r = await webhookPOST(new Request("https://app.test/x?data.id=555", { method: "POST", body: JSON.stringify({ data: { id: "555" }, amount: 1, external_reference: "fo-pedcuota:ped-1-c1", status: "approved" }) })) as unknown as { body: Record<string, unknown> };
    expect(r.body).toMatchObject({ ok: true, applied: false });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("ignora un pago de otra cosa y un aviso sin identificador; siempre 200", async () => {
    H.pagos.set("888", pago("888", "x", 1, { externalReference: "store:abc" }));
    expect((await aviso("888")).body).toMatchObject({ ok: true, applied: false, motivo: "no es de un pedido" });
    const sin = await aviso(null);
    expect(sin.init?.status).toBe(200);
  });

  it("un error inesperado responde 200 igual", async () => {
    B.tablas.fotofficeCobro.findFirst = async () => {
      throw new Error("base caída");
    };
    const r = await aviso("999");
    expect(r.init?.status).toBe(200);
  });
});
