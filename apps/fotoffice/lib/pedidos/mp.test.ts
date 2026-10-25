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
  /** Dueño de cada pago (el token que puede leerlo); sin dueño, cualquiera lo lee. */
  duenos: new Map<string, string>(),
  getPayment: vi.fn(async (id: string, token?: string) => {
    const p = H.pagos.get(id);
    if (!p) throw new Error("no es de esta cuenta");
    const dueno = H.duenos.get(id);
    if (dueno && dueno !== token) throw new Error("no es de esta cuenta");
    return p;
  }),
  enviar: vi.fn(async (..._a: unknown[]) => ({ status: "SENT" as const, providerId: "re-1" })),
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
vi.mock("@/lib/communications/send-email", () => ({ sendTransactionalEmail: H.enviar }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: H.collector }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String((e as Error)?.message ?? e).slice(0, 40) }));
vi.mock("@repo/payments/mercado-pago", () => ({
  createMercadoPagoCheckoutProLiveAdapter: (opts: { accessToken?: string }) => {
    H.adaptadores.push(opts);
    return { createPreference: H.preferencia, getPayment: (id: string) => H.getPayment(id, opts.accessToken), searchPaymentsByExternalReference: H.search };
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
const checklist = () => B.datos.fotofficePedidoTarea.map((t) => ({ pedidoId: t.pedidoId, title: t.title, doneAt: t.doneAt }));

let errores: ReturnType<typeof vi.spyOn>;
let avisos: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.pagos.clear();
  H.notificar.mockClear();
  H.recibo.mockClear();
  H.preferencia.mockClear();
  H.getPayment.mockClear();
  H.search.mockReset().mockResolvedValue(null);
  H.enviar.mockClear();
  H.duenos.clear();
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
  B.agregar("user", { id: 7, email: "responsable@estudio.test" });
  B.agregar("user", { id: 1, email: "duena@estudio.test" });
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

  it("la comisión suma también la de la plataforma (application_fee), no la de financiación", () => {
    const h = PURO.hechosDelPago(pago("1", "c", 1000, {}, { fee_details: [{ type: "mercadopago_fee", amount: 40 }, { type: "application_fee", amount: 50 }, { type: "financing_fee", amount: 3 }] }));
    expect(h).toMatchObject({ feeMinor: 9000, conPlataforma: true });
    expect(PURO.hechosDelPago(pago("1", "c", 1000)).conPlataforma).toBe(false);
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
    // Etapa B: el INGRESO por el bruto y la comisión real de Mercado Pago como EGRESO, en la misma cuenta.
    expect(B.datos.cashMovement).toHaveLength(2);
    expect(B.datos.cashMovement[0]).toMatchObject({ kind: "INGRESO", amountArs: "40000.00", accountId: "mp", createdByUserId: null, sourceRef: c.id });
    expect(B.datos.cashMovement[1]).toMatchObject({
      kind: "EGRESO", amountArs: "5.50", accountId: "mp", paymentMethod: "MERCADO_PAGO", sourceModule: "pedidos-comision", sourceRef: c.id,
      categoryId: B.datos.cashCategory.find((x) => x.name === "Comisiones de Mercado Pago" && x.kind === "EGRESO")!.id,
    });
    expect(B.datos.fotofficePedido[0]!.status).toBe("EN_CURSO");
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "SENA_COBRADA", c.id);
    expect(H.recibo).toHaveBeenCalledWith("ws-1", c.id);
    expect(tareas()).toHaveLength(0);
  });

  it("sin fee_details, comisión y neto quedan null", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, { fee_details: [] }));
    expect(B.datos.fotofficeCobro[0]).toMatchObject({ feeArs: null, netArs: null });
    // Sin comisión conocida, no hay EGRESO.
    expect(B.datos.cashMovement.map((m) => m.kind)).toEqual(["INGRESO"]);
  });

  it("el mismo aviso repetido no acredita dos veces", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    const otra = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(otra).toEqual({ resultado: "ya_acreditado", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect(B.datos.cashMovement).toHaveLength(2);
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
    // Sólo los del primer pago: su ingreso y su comisión.
    expect(B.datos.cashMovement.map((m) => m.kind)).toEqual(["INGRESO", "EGRESO"]);
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

  it("sin consulta igual queda rastro: tarea en el pedido y correo al responsable (B2-1)", async () => {
    B.datos.fotofficePedido[0]!.consultaLeadId = null;
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(r).toMatchObject({ resultado: "sin_aplicar", motivo: "CANCELADO" });
    expect(tareas()).toHaveLength(0);
    expect(checklist()).toEqual([
      { pedidoId: "ped-1", title: "Mercado Pago: llegó el pago N° pay-1 de $ 40.000,00 y no se pudo aplicar (el pedido está cancelado). Aplicalo a mano o devolvelo.", doneAt: null },
    ]);
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    const correo = H.enviar.mock.calls[0]![0] as { to: string; subject: string; text: string };
    expect(correo.to).toBe("responsable@estudio.test");
    expect(correo.text).toContain("pago N° pay-1");
    expect(correo.text).toContain("Es del pedido N° 2026-0001.");
    expect(correo.text).toContain("https://app.test/pedidos/ped-1");
    expect(correo.text).not.toMatch(/plata/i);
  });

  it("el mismo pago sin aplicar avisado dos veces deja una sola tarea y un solo correo", async () => {
    B.datos.fotofficePedido[0]!.consultaLeadId = null;
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    expect(checklist()).toHaveLength(1);
  });

  it("con consulta deja la tarea de la consulta Y la del pedido", async () => {
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    expect(tareas()).toHaveLength(1);
    expect(checklist()).toHaveLength(1);
  });

  it("si el responsable ya no está, el correo va a la dueña; con el tope del día, no sale", async () => {
    B.datos.fotofficePedido[0]!.ownerUserId = 99;
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    expect((H.enviar.mock.calls[0]![0] as { to: string }).to).toBe("duena@estudio.test");
    for (let i = 0; i < 60; i++) B.agregar("fotofficePedidoTarea", { workspaceId: "ws-1", pedidoId: "ped-1", position: 100 + i, title: `Mercado Pago: viejo ${i}`, createdAt: new Date() });
    await MP.acreditarPagoMp("ws-1", pago("pay-2", "ped-1-c1", 40000));
    await new Promise((r) => setTimeout(r, 20));
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect(checklist().filter((t) => String(t.title).includes("pay-2"))).toHaveLength(1);
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
      amountMinor: 4000000, currency: "ARS", externalReference: "fo-pedcuota:ped-1:ped-1-c2", accessTokenOverride: "tok-ws-1",
      notificationUrl: "https://app.test/api/payments/mp/pedidos-webhook?ws=ws-1", payerEmail: "laura@example.com",
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
    const tabla = B.tablas.fotofficeCobro as { findFirst: (...a: unknown[]) => Promise<unknown> };
    const original = tabla.findFirst;
    tabla.findFirst = async () => {
      throw new Error("base caída");
    };
    try {
      const r = await aviso("999");
      expect(r.init?.status).toBe(200);
    } finally {
      tabla.findFirst = original;
    }
  });
});

describe("referencias: formato nuevo con pedido y formato viejo (B2-2)", () => {
  const conRef = (id: string, ref: string, bruto: number) => ({ ...pago(id, "x", bruto), externalReference: ref });

  it("lee los dos formatos y descarta lo que no se entiende", () => {
    expect(PURO.referenciaCuota("c1", "p1")).toBe("fo-pedcuota:p1:c1");
    expect(PURO.leerReferenciaCuota("fo-pedcuota:p1:c1")).toEqual({ pedidoId: "p1", cuotaId: "c1" });
    expect(PURO.leerReferenciaCuota("fo-pedcuota:c1")).toEqual({ pedidoId: null, cuotaId: "c1" });
    expect(PURO.cuotaDeReferencia("fo-pedcuota:p1:c1")).toBe("c1");
    expect(PURO.leerReferenciaCuota("fo-pedcuota:p1:c1:x")).toBeNull();
    expect(PURO.leerReferenciaCuota("fo-pedcuota::c1")).toBeNull();
    expect(PURO.leerReferenciaCuota("fo-pedcuota:p1:")).toBeNull();
  });

  it("acredita con la referencia nueva y con la vieja", async () => {
    expect(await MP.acreditarPagoMp("ws-1", conRef("pay-n", "fo-pedcuota:ped-1:ped-1-c1", 40000))).toEqual({ resultado: "acreditado", pedidoId: "ped-1" });
    expect(await MP.acreditarPagoMp("ws-1", conRef("pay-v", "fo-pedcuota:ped-1-c2", 40000))).toEqual({ resultado: "acreditado", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(2);
  });

  it("una referencia nueva cuyo pedido no es el de la cuota no acredita", async () => {
    pedido("ped-2", [["2026-10-07", 1000]]);
    expect(await MP.acreditarPagoMp("ws-1", conRef("pay-x", "fo-pedcuota:ped-2:ped-1-c1", 40000))).toEqual({ resultado: "no_es_de_esta_organizacion" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("cuota borrada después de abrir el pago (referencia nueva): no acredita, encuentra el pedido y deja el rastro", async () => {
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id !== "ped-1-c3");
    const r = await MP.acreditarPagoMp("ws-1", conRef("pay-3", "fo-pedcuota:ped-1:ped-1-c3", 40000));
    expect(r).toEqual({ resultado: "sin_aplicar", motivo: "CUOTA_INEXISTENTE", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
    expect(checklist()).toEqual([
      { pedidoId: "ped-1", title: "Mercado Pago: llegó el pago N° pay-3 de $ 40.000,00 por una cuota que ya no existe: aplicalo a mano o devolvelo.", doneAt: null },
    ]);
    expect(tareas()).toHaveLength(1); // la de la consulta
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    expect((H.enviar.mock.calls[0]![0] as { text: string }).text).toContain("llegó el pago N° pay-3 de $ 40.000,00 por una cuota que ya no existe: aplicalo a mano o devolvelo");
  });

  it("cuota borrada con la referencia vieja: no hay pedido donde dejar la tarea, pero sale el correo a la dueña", async () => {
    const r = await MP.acreditarPagoMp("ws-1", conRef("pay-4", "fo-pedcuota:cuota-borrada", 40000));
    expect(r).toEqual({ resultado: "sin_aplicar", motivo: "CUOTA_INEXISTENTE", pedidoId: null });
    expect(checklist()).toHaveLength(0);
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    const correo = H.enviar.mock.calls[0]![0] as { to: string; text: string };
    expect(correo.to).toBe("duena@estudio.test");
    expect(correo.text).toContain("por una cuota que ya no existe");
    expect(correo.text).toContain("No pudimos saber de qué pedido es");
  });

  it("cuota borrada con la referencia vieja: el aviso repetido de Mercado Pago no repite el correo", async () => {
    for (let i = 0; i < 3; i++) await MP.acreditarPagoMp("ws-1", conRef("pay-4", "fo-pedcuota:cuota-borrada", 40000));
    await new Promise((r) => setTimeout(r, 20));
    expect(H.enviar).toHaveBeenCalledTimes(1);
    expect((H.enviar.mock.calls[0]![0] as { subject: string }).subject).toContain("(pago N° pay-4)");
    expect(B.datos.sentEmailLog).toEqual([expect.objectContaining({ templateKey: "fotoffice-mp-pago-sin-pedido:ws-1", status: "SENT" })]);
  });

  it("sin pedido: si el correo falló, el próximo aviso lo reintenta; y tiene su propio tope diario", async () => {
    H.enviar.mockResolvedValueOnce({ status: "PROVIDER_REJECTED", detail: "x" } as never);
    await MP.acreditarPagoMp("ws-1", conRef("pay-r", "fo-pedcuota:cuota-borrada", 40000));
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    await MP.acreditarPagoMp("ws-1", conRef("pay-r", "fo-pedcuota:cuota-borrada", 40000));
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(2));
    for (let i = 0; i < 60; i++) B.agregar("sentEmailLog", { to: "x", subject: `viejo ${i}`, templateKey: "fotoffice-mp-pago-sin-pedido:ws-1", status: "SENT", createdAt: new Date() });
    await MP.acreditarPagoMp("ws-1", conRef("pay-tope", "fo-pedcuota:cuota-borrada", 40000));
    await new Promise((r) => setTimeout(r, 20));
    expect(H.enviar).toHaveBeenCalledTimes(2);
  });

  it("cuota borrada y pago no aprobado: nada que avisar", async () => {
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id !== "ped-1-c3");
    const r = await MP.acreditarPagoMp("ws-1", { ...conRef("pay-5", "fo-pedcuota:ped-1:ped-1-c3", 40000), status: "PENDING", rawSanitized: { status: "pending" } });
    expect(r).toEqual({ resultado: "no_aprobado" });
    expect(checklist()).toHaveLength(0);
  });

  it("el pedido de la referencia nueva es de otra organización: no deja nada", async () => {
    pedido("ped-ajeno", [["2026-10-07", 1000]], { workspaceId: "ws-2" });
    const r = await MP.acreditarPagoMp("ws-1", conRef("pay-6", "fo-pedcuota:ped-ajeno:cuota-borrada", 1000));
    expect(r).toEqual({ resultado: "no_es_de_esta_organizacion" });
    expect(checklist()).toHaveLength(0);
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("la vuelta busca primero por la referencia nueva y después por la vieja", async () => {
    H.search.mockImplementation(async (ref: unknown) => (ref === "fo-pedcuota:ped-1-c1" ? pago("pay-7", "ped-1-c1", 40000) : null));
    expect(await MP.verificarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" })).toEqual({ resultado: "acreditado" });
    expect(H.search.mock.calls.map((c) => c[0])).toEqual(["fo-pedcuota:ped-1:ped-1-c1", "fo-pedcuota:ped-1-c1"]);
  });
});

describe("el aviso identifica la organización (B2-3)", () => {
  type Resp = { body: Record<string, unknown>; init?: { status?: number } };
  const aviso = (id: string, query = "") =>
    webhookPOST(new Request(`https://app.test/api/payments/mp/pedidos-webhook?type=payment&data.id=${id}${query}`, { method: "POST", body: JSON.stringify({ data: { id }, type: "payment" }) })) as unknown as Promise<Resp>;

  beforeEach(() => {
    B.agregar("workspaceMembership", { workspaceId: "ws-2", userId: 20, role: "WORKSPACE_OWNER" });
    pedido("ped-ws2", [["2026-10-07", 1000]], { workspaceId: "ws-2" });
    B.datos.fotofficePedidoCuota.filter((c) => c.pedidoId === "ped-ws2").forEach((c) => (c.workspaceId = "ws-2"));
  });

  it("con ?ws= lee el pago sólo con ese token y acredita", async () => {
    H.pagos.set("701", { ...pago("701", "ped-1-c1", 40000), externalReference: "fo-pedcuota:ped-1:ped-1-c1" });
    H.duenos.set("701", "tok-ws-1");
    const r = await aviso("701", "&ws=ws-1");
    expect(r.body).toMatchObject({ ok: true, applied: true, resultado: "acreditado" });
    expect(H.adaptadores).toEqual([{ accessToken: "tok-ws-1" }]);
  });

  it("un ?ws= equivocado se rechaza: su token no puede leer el pago y no se prueba con otros", async () => {
    H.pagos.set("702", pago("702", "ped-1-c1", 40000));
    H.duenos.set("702", "tok-ws-1");
    const r = await aviso("702", "&ws=ws-2");
    expect(r.body).toMatchObject({ ok: true, applied: false, motivo: "el pago no es de esa organización" });
    expect(r.init).toBeUndefined();
    expect(H.adaptadores).toEqual([{ accessToken: "tok-ws-2" }]);
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("un ?ws= cuyo token lee el pago pero la cuota es de otra organización no acredita", async () => {
    H.pagos.set("703", pago("703", "ped-1-c1", 40000));
    H.duenos.set("703", "tok-ws-2");
    expect((await aviso("703", "&ws=ws-2")).body).toMatchObject({ applied: false, resultado: "no_es_de_esta_organizacion" });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("un ?ws= con forma rara se ignora y se usa la prueba de siempre", async () => {
    H.pagos.set("704", pago("704", "ped-1-c1", 40000));
    H.duenos.set("704", "tok-ws-1");
    expect((await aviso("704", "&ws=%27%3B%20drop")).body).toMatchObject({ applied: true });
  });

  it("sin ?ws= (preferencia vieja) también prueba organizaciones cuyo pedido está COMPLETADO", async () => {
    B.datos.fotofficePedido.filter((p) => p.workspaceId === "ws-2").forEach((p) => (p.status = "CANCELADO"));
    B.datos.fotofficePedido[0]!.status = "COMPLETADO"; // un completado con saldo admite cobros
    H.pagos.set("705", pago("705", "ped-1-c1", 40000));
    H.duenos.set("705", "tok-ws-1");
    expect((await aviso("705")).body).toMatchObject({ applied: true, resultado: "acreditado" });
  });

  it("con más de 20 organizaciones, prueba primero las de actividad más reciente", async () => {
    for (let i = 0; i < 25; i++) {
      B.agregar("fotofficePedido", { id: `viejo-${i}`, workspaceId: `ws-v${i}`, number: `V-${i}`, clientId: "cli-x", status: "CONFIRMADO", items: [], totals: {}, totalArs: "1.00", updatedAt: new Date(2025, 0, 1) });
    }
    for (const p of B.datos.fotofficePedido) if (!String(p.workspaceId).startsWith("ws-v")) p.updatedAt = p.workspaceId === "ws-1" ? new Date(2026, 9, 10) : new Date(2024, 0, 1);
    H.pagos.set("706", pago("706", "ped-1-c1", 40000));
    H.duenos.set("706", "tok-ws-1");
    expect((await aviso("706")).body).toMatchObject({ applied: true });
    expect(H.adaptadores).toEqual([{ accessToken: "tok-ws-1" }]);
  });

  it("si ninguna organización puede leerlo, responde 200 sin acreditar", async () => {
    H.pagos.set("707", pago("707", "ped-1-c1", 40000));
    H.duenos.set("707", "tok-ws-nadie");
    const r = await aviso("707");
    expect(r.body).toMatchObject({ ok: true, applied: false, motivo: "no se pudo resolver el pago" });
    expect(r.init).toBeUndefined();
  });
});

describe("devoluciones y contracargos de un pago ya acreditado (B2-4)", () => {
  type Resp = { body: Record<string, unknown>; init?: { status?: number } };
  const aviso = (id: string) =>
    webhookPOST(new Request(`https://app.test/api/payments/mp/pedidos-webhook?type=payment&data.id=${id}&ws=ws-1`, { method: "POST", body: "{}" })) as unknown as Promise<Resp>;
  const comoQuedo = (id: string, status: string, raw: Record<string, unknown>) => H.pagos.set(id, pago(id, "ped-1-c1", 40000, { status }, raw));

  beforeEach(async () => {
    comoQuedo("801", "APPROVED", {});
    await aviso("801");
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    H.enviar.mockClear();
  });

  it("una devolución deja el aviso una sola vez, no anula el cobro ni toca Caja", async () => {
    comoQuedo("801", "REFUNDED", { status: "refunded", status_detail: "refunded" });
    expect((await aviso("801")).body).toMatchObject({ ok: true, applied: false, motivo: "devolución", resultado: "avisado" });
    expect((await aviso("801")).body).toMatchObject({ resultado: "ya_avisado" });
    expect(checklist()).toEqual([
      { pedidoId: "ped-1", title: "Mercado Pago devolvió (o le reclamaron) el pago N° 801 de $ 40.000,00 (devuelto): anulá el cobro si corresponde.", doneAt: null },
    ]);
    expect(tareas().map((t) => t.title)).toEqual([PURO.TITULO_TAREA_PAGO_DEVUELTO]);
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    expect((H.enviar.mock.calls[0]![0] as { subject: string }).subject).toMatch(/devolvió/);
    expect(B.datos.fotofficeCobro[0]!.voidedAt ?? null).toBeNull();
    expect(B.datos.cashMovement).toHaveLength(2);
  });

  it("después de la devolución, un contracargo del mismo pago avisa de nuevo (otro estado)", async () => {
    comoQuedo("801", "REFUNDED", { status: "refunded" });
    await aviso("801");
    comoQuedo("801", "CHARGEBACK", { status: "charged_back" });
    expect((await aviso("801")).body).toMatchObject({ resultado: "avisado" });
    expect(checklist().map((t) => t.title)).toEqual([
      expect.stringContaining("(devuelto)"),
      expect.stringContaining("(contracargo)"),
    ]);
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(2));
  });

  it("devolución parcial (sigue approved con status_detail partially_refunded), reclamo y cancelado también avisan", async () => {
    comoQuedo("801", "APPROVED", { status: "approved", status_detail: "partially_refunded" });
    expect((await aviso("801")).body).toMatchObject({ resultado: "avisado" });
    comoQuedo("801", "PROCESSING", { status: "in_mediation" });
    expect((await aviso("801")).body).toMatchObject({ resultado: "avisado" });
    comoQuedo("801", "CANCELLED", { status: "cancelled" });
    expect((await aviso("801")).body).toMatchObject({ resultado: "avisado" });
    expect(checklist().map((t) => /\(([^)]+)\): anulá/.exec(String(t.title))?.[1])).toEqual(["devuelto en parte", "en reclamo", "cancelado"]);
  });

  it("si sigue aprobado es un aviso repetido y no avisa nada", async () => {
    expect((await aviso("801")).body).toMatchObject({ motivo: "aviso repetido" });
    expect(checklist()).toHaveLength(0);
    expect(H.enviar).not.toHaveBeenCalled();
  });

  it("si el cobro ya se anuló a mano, no hay nada que avisar", async () => {
    B.datos.fotofficeCobro[0]!.voidedAt = new Date();
    comoQuedo("801", "REFUNDED", { status: "refunded" });
    expect((await aviso("801")).body).toMatchObject({ motivo: "aviso repetido" });
    expect(checklist()).toHaveLength(0);
  });

  it("si Mercado Pago no responde al releerlo, o la base falla, responde 200 igual", async () => {
    H.pagos.delete("801");
    expect((await aviso("801")).body).toMatchObject({ motivo: "aviso repetido" });
    const tabla = B.tablas.fotofficeCobro as { findFirst: (...a: unknown[]) => Promise<unknown> };
    const original = tabla.findFirst;
    tabla.findFirst = async () => {
      throw new Error("base caída");
    };
    try {
      expect((await aviso("801")).init?.status).toBe(200);
    } finally {
      tabla.findFirst = original;
    }
  });

  it("los textos no dicen \"plata\" y los registros no tienen datos personales", async () => {
    comoQuedo("801", "REFUNDED", { status: "refunded" });
    await aviso("801");
    await vi.waitFor(() => expect(H.enviar).toHaveBeenCalledTimes(1));
    expect(JSON.stringify([checklist(), H.enviar.mock.calls])).not.toMatch(/plata/i);
    expect(JSON.stringify([errores.mock.calls, avisos.mock.calls])).not.toMatch(/estudio\.test/);
  });
});


describe("comisión de Mercado Pago en Caja (etapa B)", () => {
  it("al anular el cobro se anulan el ingreso y la comisión", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    const c = B.datos.fotofficeCobro[0]!;
    const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };
    const r = await CO.anularCobro(DUENO, c.id as string, "Devuelto", { ahora: () => AHORA });
    expect(r).toMatchObject({ ok: true, yaAnulado: false });
    const ingreso = B.datos.cashMovement.find((m) => m.sourceModule === "pedidos")!;
    const comision = B.datos.cashMovement.find((m) => m.sourceModule === "pedidos-comision")!;
    expect(B.datos.cashMovement.filter((m) => m.reversesMovementId === ingreso.id)).toHaveLength(1);
    expect(B.datos.cashMovement.filter((m) => m.reversesMovementId === comision.id)).toEqual([expect.objectContaining({ kind: "INGRESO", amountArs: "5.50" })]);
  });

  it("dos comisiones usan el mismo rubro (no lo crea dos veces)", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000));
    await MP.acreditarPagoMp("ws-1", pago("pay-2", "ped-1-c2", 40000));
    expect(B.datos.cashCategory.filter((x) => x.name === "Comisiones de Mercado Pago")).toHaveLength(1);
  });
});

describe("comisión de plataforma en pedidos de digitalización (F1)", () => {
  // Después del corte (23/10, 00:00 de Argentina): el pago se aprobó el 24 y hoy es 25.
  const DESPUES = { date_approved: "2026-10-24T14:00:00.000Z" };
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T15:00:00.000Z"));
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    B.agregar("workspaceModuleFee", { workspaceId: "ws-1", moduleKey: "digitalizacion", feeBps: 500 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("la preferencia retiene la propia más la deuda, y lo deja en la metadata", async () => {
    B.agregar("workspaceFeeLedgerEntry", { workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "300.00" });
    await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" });
    const arg = H.preferencia.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({ amountMinor: 4_000_000, marketplaceFeeMinor: 230_000 });
    expect(arg.metadata).toMatchObject({ fo_comision_propia_minor: "200000", fo_retencion_minor: "230000" });
  });

  it("con 0 bps (DNX) no retiene nada", async () => {
    B.datos.workspaceModuleFee[0]!.feeBps = 0;
    await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" });
    const arg = H.preferencia.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).not.toHaveProperty("marketplaceFeeMinor");
    expect(arg.metadata).not.toHaveProperty("fo_retencion_minor");
  });

  it("al acreditar: neto y EGRESO con las dos comisiones, deuda descargada y cobro marcado (no se devenga)", async () => {
    B.agregar("workspaceFeeLedgerEntry", { workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "300.00" });
    const r = await MP.acreditarPagoMp(
      "ws-1",
      pago("pay-1", "ped-1-c1", 40000, {}, {
        ...DESPUES,
        fee_details: [{ type: "mercadopago_fee", amount: 1000 }, { type: "application_fee", amount: 2300 }],
        platform_fee_metadata: { own_minor: "200000", withheld_minor: "230000" },
      }),
    );
    expect(r.resultado).toBe("acreditado");
    const c = B.datos.fotofficeCobro[0]!;
    expect([c.feeArs, c.netArs]).toEqual(["3300.00", "36700.00"]);
    const egreso = B.datos.cashMovement.find((m) => m.sourceModule === "pedidos-comision")!;
    expect(egreso).toMatchObject({ kind: "EGRESO", amountArs: "3300.00" });
    expect(String(egreso.description)).toMatch(/^Comisiones Mercado Pago y plataforma · pedido N° /);
    const ret = B.datos.workspaceFeeLedgerEntry.find((a) => a.kind === "RETENIDO")!;
    expect(ret.amountArs).toBe("-300.00");
    expect(B.datos.digitalizacionComision).toEqual([expect.objectContaining({ cobroId: c.id, ledgerEntryId: ret.id })]);
    expect(B.datos.workspaceFeeLedgerEntry.filter((a) => a.kind === "DEVENGADO")).toHaveLength(1);
  });

  it("un pago sin retención (abierto antes de la entrega) devenga como un cobro manual", async () => {
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, DESPUES));
    expect(r.resultado).toBe("acreditado");
    expect(B.datos.workspaceFeeLedgerEntry.map((a) => [a.kind, a.amountArs])).toEqual([["DEVENGADO", "2000.00"]]);
    expect(B.datos.digitalizacionComision).toHaveLength(1);
    const egreso = B.datos.cashMovement.find((m) => m.sourceModule === "pedidos-comision")!;
    expect(String(egreso.description)).toMatch(/^Comisión Mercado Pago · /);
  });

  it("si la marca falla, el cobro tampoco queda (como cualquier falla de la acreditación)", async () => {
    const original = B.tablas.digitalizacionComision.create;
    B.tablas.digitalizacionComision.create = async () => {
      throw new Error("se cayó la base");
    };
    const r = await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, { ...DESPUES, fee_details: [{ type: "application_fee", amount: 2000 }] }));
    B.tablas.digitalizacionComision.create = original;
    expect(r.resultado).toBe("sin_aplicar");
    expect(B.datos.fotofficeCobro).toHaveLength(0);
    expect(B.datos.workspaceFeeLedgerEntry).toHaveLength(0);
    // La tarea para el equipo dice cuánto retuvo la plataforma.
    expect(JSON.stringify(B.datos.fotofficePedidoTarea)).toContain("La plataforma ya retuvo 2.000 pesos de comisión de este pago");
  });

  it("un pago sin aplicar sin retención no habla de la plataforma", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 999999, {}, DESPUES));
    expect(JSON.stringify(B.datos.fotofficePedidoTarea)).toContain("no se pudo aplicar");
    expect(JSON.stringify(B.datos.fotofficePedidoTarea)).not.toContain("retuvo");
  });

  it("sólo cuenta el application_fee: con metadatos pero sin application_fee, devenga", async () => {
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, { ...DESPUES, platform_fee_metadata: { own_minor: "200000", withheld_minor: "200000" } }));
    expect(B.datos.workspaceFeeLedgerEntry.map((a) => [a.kind, a.amountArs])).toEqual([["DEVENGADO", "2000.00"]]);
  });

  it("un application_fee inválido se ignora y no anula la comisión de Mercado Pago", async () => {
    await MP.acreditarPagoMp(
      "ws-1",
      pago("pay-1", "ped-1-c1", 40000, {}, { ...DESPUES, fee_details: [{ type: "mercadopago_fee", amount: 1000 }, { type: "application_fee", amount: "x" }] }),
    );
    expect(B.datos.fotofficeCobro[0]!.feeArs).toBe("1000.00");
    expect(B.datos.workspaceFeeLedgerEntry.map((a) => a.kind)).toEqual(["DEVENGADO"]);
  });

  it("si la tasa no se puede leer, la preferencia no retiene (lo concilia el cron después)", async () => {
    const original = B.tablas.workspaceModuleFee.findUnique;
    B.tablas.workspaceModuleFee.findUnique = async () => {
      throw new Error("se cayó la base");
    };
    await MP.iniciarPagoCuota({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: "ped-1-c1" });
    B.tablas.workspaceModuleFee.findUnique = original;
    expect(H.preferencia.mock.calls[0]![0]).not.toHaveProperty("marketplaceFeeMinor");
  });

  it("la devolución de un pago que canceló deuda la vuelve a dejar pendiente, una sola vez", async () => {
    B.agregar("workspaceFeeLedgerEntry", { workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "300.00" });
    const crudo = {
      ...DESPUES,
      fee_details: [{ type: "application_fee", amount: 2300 }],
      platform_fee_metadata: { own_minor: "200000", withheld_minor: "230000" },
    };
    await MP.acreditarPagoMp("ws-1", pago("pay-1", "ped-1-c1", 40000, {}, crudo));
    const devuelto = pago("pay-1", "ped-1-c1", 40000, { status: "REFUNDED" }, { ...crudo, status: "refunded" });
    await MP.avisarDevolucionMp("ws-1", devuelto);
    await MP.avisarDevolucionMp("ws-1", devuelto);
    expect(B.datos.workspaceFeeLedgerEntry.map((a) => [a.kind, a.amountArs])).toEqual([["DEVENGADO", "300.00"], ["RETENIDO", "-300.00"], ["REVERSADO", "300.00"]]);
  });
});
