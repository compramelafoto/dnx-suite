import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const H = vi.hoisted(() => ({
  notificar: vi.fn(async (..._a: unknown[]) => ({ movido: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: H.notificar }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
}));

const CO = await import("./cobros");
const EN = await import("./enlace");
const RE = await import("./recibos");
const { MENSAJES_PEDIDO: M } = await import("./acceso");

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const deps = { ahora: () => AHORA, clave: CLAVE };
const depsEnlace = { clave: CLAVE, appOrigin: "https://app.test" };

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

/** Un pedido con sus cuotas (importes en pesos, vencimientos "aaaa-mm-dd"). */
function pedido(id: string, cuotas: [string, number][], datos: Record<string, unknown> = {}) {
  const total = cuotas.reduce((s, [, i]) => s + i, 0);
  B.agregar("fotofficePedido", {
    id, workspaceId: "ws-1", number: `2026-000${B.datos.fotofficePedido.length + 1}`, clientId: "cli-1", status: "CONFIRMADO",
    items: [], totals: {}, totalArs: total.toFixed(2), incomeCategoryId: "rubro-bodas", consultaLeadId: "lead-1", ...datos,
  });
  cuotas.forEach(([dueDate, importe], i) =>
    B.agregar("fotofficePedidoCuota", {
      id: `${id}-c${i + 1}`, workspaceId: "ws-1", pedidoId: id, position: i + 1,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`), amountArs: importe.toFixed(2),
    }),
  );
}

let n = 0;
const clave = () => `clave-form-${++n}`;
function cobrar(pedidoId: string, importe: number, extra: Record<string, unknown> = {}, ctx = DUENO) {
  return CO.registrarCobro(ctx, { pedidoId, importe, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: clave(), ...extra }, deps);
}
async function cobrado(pedidoId: string, importe: number, extra: Record<string, unknown> = {}) {
  const r = await cobrar(pedidoId, importe, extra);
  if (!r.ok) throw new Error(r.error);
  return r;
}

const imputacionesDe = (cobroId: string) =>
  B.datos.fotofficeCobroImputacion.filter((i) => i.cobroId === cobroId).map((i) => [i.cuotaId, i.amountArs]);
const movimientos = () => B.datos.cashMovement;

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  H.notificar.mockClear();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("cashCategory", { id: "rubro-bodas", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO" });
  B.agregar("cashAccount", { id: "caja-diaria", workspaceId: "ws-1", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, order: 0 });
  B.agregar("cashAccount", { id: "caja-fuerte", workspaceId: "ws-1", name: "Caja fuerte", kind: "EFECTIVO", isVault: true, order: 10 });
  B.agregar("cashAccount", { id: "mp", workspaceId: "ws-1", name: "Mercado Pago", kind: "DIGITAL", order: 20 });
  B.agregar("cashShift", { id: "turno-1", workspaceId: "ws-1", accountId: "caja-diaria", status: "ABIERTO" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  pedido("ped-1", [["2026-10-07", 40000], ["2026-11-07", 40000], ["2026-12-07", 40000]]);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|Pérez/);
  errores.mockRestore();
});

describe("registrar un cobro", () => {
  it("imputa, numera el recibo, crea su token, deposita en Caja y pasa el pedido a EN_CURSO", async () => {
    const r = await cobrado("ped-1", 40000);
    expect(r).toMatchObject({ reciboNumero: "2026-0001", creado: true, primero: true, pedidoId: "ped-1" });
    const c = B.datos.fotofficeCobro.find((x) => x.id === r.cobroId)!;
    expect(c).toMatchObject({ workspaceId: "ws-1", clientId: "cli-1", method: "EFECTIVO", amountArs: "40000.00", receiptNumber: "2026-0001", paidAt: AHORA });
    expect(c.receiptTokenHash).toBe(EN.hashDeToken(EN.tokenDelRecibo(r.cobroId, CLAVE)));
    expect(imputacionesDe(r.cobroId)).toEqual([["ped-1-c1", "40000.00"]]);
    // Número de la secuencia RECIBO, registrado en el cobro.
    expect(B.datos.fotofficeRecordNumber.find((x) => x.entityId === r.cobroId)).toMatchObject({ sequenceKey: "RECIBO", entityType: "COBRO" });
    // Caja: INGRESO del módulo "pedidos", con rubro, contacto, medio y el turno abierto de la caja diaria.
    expect(movimientos()).toHaveLength(1);
    expect(movimientos()[0]).toMatchObject({
      id: c.cashMovementId, kind: "INGRESO", amountArs: "40000.00", sourceModule: "pedidos", sourceRef: r.cobroId,
      accountId: "caja-diaria", shiftId: "turno-1", categoryId: "rubro-bodas", clientId: "cli-1", paymentMethod: "EFECTIVO",
      description: "Cobro pedido N° 2026-0001 · recibo 2026-0001", occurredAt: AHORA,
    });
    expect(B.datos.fotofficePedido[0]!.status).toBe("EN_CURSO");
  });

  it("los medios digitales van a la cuenta digital; un día anterior se guarda a las 12 de Argentina", async () => {
    const r = await cobrado("ped-1", 1000, { medio: "TRANSFERENCIA", fecha: "2026-10-01" });
    const m = movimientos()[0]!;
    expect(m).toMatchObject({ accountId: "mp", shiftId: null, paymentMethod: "TRANSFERENCIA" });
    expect((m.occurredAt as Date).toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(B.datos.fotofficeCobro.find((x) => x.id === r.cobroId)!.paidAt).toEqual(new Date("2026-10-01T15:00:00.000Z"));
  });

  it("Caja idempotente: la misma clave devuelve el mismo cobro sin depositar otra vez", async () => {
    const datos = { pedidoId: "ped-1", importe: 40000, fecha: "2026-10-07", medio: "EFECTIVO", idempotencyKey: "doble-clic-1" };
    const a = await CO.registrarCobro(DUENO, datos, deps);
    const b = await CO.registrarCobro(DUENO, datos, deps);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b).toMatchObject({ cobroId: a.cobroId, reciboNumero: a.reciboNumero, creado: false });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect(movimientos()).toHaveLength(1);
    // La misma clave en otro pedido no sirve.
    pedido("ped-2", [["2026-10-07", 100]]);
    expect(await CO.registrarCobro(DUENO, { ...datos, pedidoId: "ped-2" }, deps)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.claveDeOtro });
  });

  it("parcial: la cuota queda con saldo y el siguiente cobro sigue de la más vieja a la más nueva", async () => {
    const a = await cobrado("ped-1", 25000);
    expect(imputacionesDe(a.cobroId)).toEqual([["ped-1-c1", "25000.00"]]);
    const b = await cobrado("ped-1", 30000);
    expect(imputacionesDe(b.cobroId)).toEqual([["ped-1-c1", "15000.00"], ["ped-1-c2", "15000.00"]]);
    expect(b.reciboNumero).toBe("2026-0002");
    expect(b.primero).toBe(false);
  });

  it("varias cuotas a mano: valida contra el saldo de cada una y la suma", async () => {
    const r = await cobrado("ped-1", 50000, { imputaciones: [{ cuotaId: "ped-1-c3", amountArs: 40000 }, { cuotaId: "ped-1-c2", amountArs: 10000 }] });
    expect(imputacionesDe(r.cobroId)).toEqual([["ped-1-c3", "40000.00"], ["ped-1-c2", "10000.00"]]);
    expect(await cobrar("ped-1", 1, { imputaciones: [{ cuotaId: "ped-1-c3", amountArs: 1 }] })).toEqual({
      ok: false, error: "Lo imputado a la cuota 3 supera su saldo.",
    });
    expect(await cobrar("ped-1", 10, { imputaciones: [{ cuotaId: "ped-1-c1", amountArs: 5 }] })).toEqual({
      ok: false, error: "Lo imputado a las cuotas tiene que sumar el importe del cobro.",
    });
    pedido("ped-2", [["2026-10-07", 100]]);
    expect(await cobrar("ped-1", 100, { imputaciones: [{ cuotaId: "ped-2-c1", amountArs: 100 }] })).toEqual({
      ok: false, error: "Una de las cuotas no es de este pedido.",
    });
  });

  it("saldo excedido: se rechaza sin escribir nada (ni número, ni Caja)", async () => {
    await cobrado("ped-1", 100000);
    expect(await cobrar("ped-1", 20000.01)).toEqual({ ok: false, error: "El importe supera el saldo del pedido." });
    expect(B.datos.fotofficeCobro).toHaveLength(1);
    expect(movimientos()).toHaveLength(1);
    expect(B.datos.fotofficeRecordNumber.filter((x) => x.sequenceKey === "RECIBO")).toHaveLength(1);
    expect((await cobrado("ped-1", 20000)).reciboNumero).toBe("2026-0002");
  });

  it("valida los datos y el permiso", async () => {
    expect(await cobrar("ped-1", 0)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.importe });
    expect(await cobrar("ped-1", 10.001)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.importe });
    expect(await cobrar("ped-1", 10, { fecha: "2026-10-08" })).toEqual({ ok: false, error: CO.MENSAJES_COBRO.fechaFutura });
    expect(await cobrar("ped-1", 10, { fecha: "2026-02-30" })).toEqual({ ok: false, error: CO.MENSAJES_COBRO.fecha });
    expect(await cobrar("ped-1", 10, { medio: "CHEQUE" })).toEqual({ ok: false, error: CO.MENSAJES_COBRO.medio });
    expect(await cobrar("ped-1", 10, { idempotencyKey: "x" })).toEqual({ ok: false, error: CO.MENSAJES_COBRO.clave });
    expect(await cobrar("ped-1", 10, { adjuntoId: "no-existe" })).toEqual({ ok: false, error: CO.MENSAJES_COBRO.adjunto });
    expect(await cobrar("ped-1", 10, {}, LECTOR)).toEqual({ ok: false, error: M.sinPermiso });
    // Otro workspace (con su Caja encendida) no ve el pedido.
    B.agregar("workspaceFeatureModule", { workspaceId: "ws-2", moduleKey: "cash", enabled: true });
    expect(await cobrar("ped-1", 10, {}, OTRO)).toEqual({ ok: false, error: M.noExiste });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("el pedido cancelado rechaza cobros", async () => {
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    expect(await cobrar("ped-1", 100)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.cancelado });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
  });

  it("todo cobro entra en Caja: sin Caja encendida o sin cuenta, no hay cobro", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect(await cobrar("ped-1", 100)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.sinCaja });
    B.datos.workspaceFeatureModule[0]!.enabled = true;
    for (const a of B.datos.cashAccount) if (!a.isVault) a.isActive = false;
    expect(await cobrar("ped-1", 100)).toEqual({ ok: false, error: CO.MENSAJES_COBRO.sinCuenta });
    expect(B.datos.fotofficeCobro).toHaveLength(0);
    expect(movimientos()).toHaveLength(0);
  });

  it("SENA_COBRADA sólo con el primer cobro vigente, con la consulta del pedido", async () => {
    const a = await cobrado("ped-1", 1000);
    await cobrado("ped-1", 1000);
    expect(H.notificar).toHaveBeenCalledTimes(1);
    expect(H.notificar).toHaveBeenCalledWith("ws-1", { tipo: "CAPTACION", id: "lead-1" }, "SENA_COBRADA", a.cobroId);
    // Sin consulta: no hay a quién avisar, pero igual pasa a EN_CURSO.
    pedido("ped-2", [["2026-10-07", 100]], { consultaLeadId: null });
    expect((await cobrado("ped-2", 100)).primero).toBe(true);
    expect(H.notificar).toHaveBeenCalledTimes(1);
    expect(B.datos.fotofficePedido.find((p) => p.id === "ped-2")!.status).toBe("EN_CURSO");
  });

  it("una falla del motor no frena el cobro", async () => {
    H.notificar.mockRejectedValueOnce(new Error("motor"));
    expect((await cobrar("ped-1", 100)).ok).toBe(true);
    expect(B.datos.fotofficeCobro).toHaveLength(1);
  });
});

describe("anular un cobro", () => {
  it("contramovimiento en Caja, marca el cobro y libera las imputaciones; dos veces no hace nada", async () => {
    const a = await cobrado("ped-1", 40000);
    expect(await CO.anularCobro(DUENO, a.cobroId, "  ")).toEqual({ ok: false, error: CO.MENSAJES_COBRO.motivo });
    expect(await CO.anularCobro(DUENO, a.cobroId, "Se cargó dos veces", deps)).toEqual({ ok: true, yaAnulado: false, pedidoId: "ped-1" });
    const c = B.datos.fotofficeCobro[0]!;
    expect(c).toMatchObject({ voidedAt: AHORA, voidReason: "Se cargó dos veces" });
    expect(movimientos()).toHaveLength(2);
    const contra = movimientos()[1]!;
    expect(contra).toMatchObject({
      id: c.voidCashMovementId, kind: "EGRESO", amountArs: "40000.00", accountId: "caja-diaria", shiftId: "turno-1",
      reversesMovementId: c.cashMovementId, reverseReason: "Se cargó dos veces", sourceModule: "manual", sourceRef: null,
    });
    expect(await CO.anularCobro(DUENO, a.cobroId, "Otra vez", deps)).toEqual({ ok: true, yaAnulado: true, pedidoId: "ped-1" });
    expect(movimientos()).toHaveLength(2);
    // La cuota 1 volvió a tener saldo: el próximo cobro la imputa de nuevo, y vuelve a ser el primero vigente.
    const b = await cobrado("ped-1", 40000);
    expect(imputacionesDe(b.cobroId)).toEqual([["ped-1-c1", "40000.00"]]);
    expect(b.primero).toBe(true);
  });

  it("si ya se anuló el movimiento a mano desde Caja, usa esa anulación", async () => {
    const a = await cobrado("ped-1", 100);
    const mov = movimientos()[0]!;
    const manual = B.agregar("cashMovement", {
      workspaceId: "ws-1", accountId: "caja-diaria", kind: "EGRESO", amountArs: "100.00", occurredAt: AHORA, description: "x",
      reversesMovementId: mov.id, reverseReason: "a mano",
    });
    expect((await CO.anularCobro(DUENO, a.cobroId, "Duplicado", deps)).ok).toBe(true);
    expect(movimientos()).toHaveLength(2);
    expect(B.datos.fotofficeCobro[0]!.voidCashMovementId).toBe(manual.id);
  });

  it("sólo del workspace y con permiso", async () => {
    const a = await cobrado("ped-1", 100);
    expect(await CO.anularCobro(OTRO, a.cobroId, "x")).toEqual({ ok: false, error: CO.MENSAJES_COBRO.noExiste });
    expect(await CO.anularCobro(LECTOR, a.cobroId, "x")).toEqual({ ok: false, error: M.sinPermiso });
    expect(B.datos.fotofficeCobro[0]!.voidedAt).toBeNull();
  });
});

describe("enlaces del pedido y del recibo", () => {
  it("el recibo se abre con su token; el token del recibo no abre el pedido ni el del pedido el recibo", async () => {
    const a = await cobrado("ped-1", 100);
    const tokenRecibo = EN.tokenDelRecibo(a.cobroId, CLAVE);
    expect(await EN.resolverTokenRecibo("ws-1", tokenRecibo)).toEqual({ workspaceId: "ws-1", cobroId: a.cobroId, pedidoId: "ped-1" });
    expect(await EN.resolverTokenRecibo("ws-2", tokenRecibo)).toBeNull();

    const e = await EN.enlaceDelPedido(DUENO, "ped-1", {}, depsEnlace);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    const tokenPedido = EN.tokenDelPedido("ped-1", CLAVE, 0);
    expect(e.url).toBe(`https://app.test/w/dnxestudio/pedido/${tokenPedido}`);
    expect(await EN.resolverTokenPedido("ws-1", tokenPedido)).toEqual({ workspaceId: "ws-1", pedidoId: "ped-1" });
    expect(await EN.resolverTokenPedido("ws-1", tokenRecibo)).toBeNull();
    expect(await EN.resolverTokenRecibo("ws-1", tokenPedido)).toBeNull();
    expect(await EN.resolverTokenPedido("ws-2", tokenPedido)).toBeNull();
    expect(await EN.resolverTokenPedido("ws-1", "corto")).toBeNull();
  });

  it("el enlace del pedido se rearma igual y al renovarlo el viejo deja de abrir", async () => {
    const a = await EN.enlaceDelPedido(DUENO, "ped-1", {}, depsEnlace);
    const b = await EN.enlaceDelPedido(DUENO, "ped-1", {}, depsEnlace);
    expect(a).toEqual(b);
    const c = await EN.enlaceDelPedido(DUENO, "ped-1", { rotar: true }, depsEnlace);
    expect(c.ok && a.ok && c.url !== a.url).toBe(true);
    expect(await EN.resolverTokenPedido("ws-1", EN.tokenDelPedido("ped-1", CLAVE, 0))).toBeNull();
    expect(await EN.resolverTokenPedido("ws-1", EN.tokenDelPedido("ped-1", CLAVE, 1))).not.toBeNull();
    expect(await EN.enlaceDelPedido(LECTOR, "ped-1", {}, depsEnlace)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await EN.enlaceDelPedido(DUENO, "ped-1", {}, { ...depsEnlace, clave: null })).toEqual({ ok: false, error: EN.MENSAJES_ENLACE.sinClave });
  });

  it("enlace del recibo y lista de recibos", async () => {
    const a = await cobrado("ped-1", 100);
    const r = await EN.enlaceDelRecibo(DUENO, a.cobroId, depsEnlace);
    expect(r).toEqual({ ok: true, url: `https://app.test/w/dnxestudio/recibo/${EN.tokenDelRecibo(a.cobroId, CLAVE)}` });
    expect(await EN.enlaceDelRecibo(OTRO, a.cobroId, depsEnlace)).toEqual({ ok: false, error: "No encontramos ese cobro." });
  });
});

describe("recibo", () => {
  it("numerado, con el importe en letras, el medio, las cuotas imputadas y la leyenda; anulado se marca", async () => {
    const a = await cobrado("ped-1", 50000.5);
    const r = await RE.leerRecibo("ws-1", a.cobroId);
    expect(r).toMatchObject({
      numero: "2026-0001", fecha: "2026-10-07", cliente: "Laura Pérez", pedidoNumero: "2026-0001", concepto: "Pedido N° 2026-0001",
      importe: 50000.5, importeEnLetras: "cincuenta mil pesos con 50/100", medioEtiqueta: "Efectivo", anulado: false,
      leyenda: "Documento no válido como factura",
      cuotas: [{ position: 1, dueDate: "2026-10-07", amountArs: 40000 }, { position: 2, dueDate: "2026-11-07", amountArs: 10000.5 }],
    });
    expect(r).not.toHaveProperty("voidReason");
    await CO.anularCobro(DUENO, a.cobroId, "Error", deps);
    expect((await RE.leerRecibo("ws-1", a.cobroId))!.anulado).toBe(true);
    expect(await RE.leerRecibo("ws-2", a.cobroId)).toBeNull();
  });
});
