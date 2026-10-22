import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: vi.fn(async () => ({ movido: true })) }));

const CA = await import("./cargos");
const PL = await import("./plan");
const { saldoDelPedido, saldoSinExtrasOpcionales, exigirPedidoPagado } = await import("./candado-saldo");
const { validarPlan } = await import("./plan-cuotas");
const { itemsGuardados } = await import("@/lib/presupuestos/versiones");
const { calcularTotales } = await import("@/lib/presupuestos/totales");

// 12:00 en Buenos Aires del 22/10; a las 23:30 de Argentina ya es 23/10 en UTC.
/** Abre una transacción de la base en memoria (su `prisma` no tiene tipos). */
const enTransaccion = <T,>(fn: (tx: never) => Promise<T>): Promise<T> =>
  (B.prisma as unknown as { $transaction: (f: (tx: never) => Promise<T>) => Promise<T> }).$transaction(fn);

const AHORA = new Date("2026-10-22T15:00:00.000Z");
const NOCHE = new Date("2026-10-23T02:30:00.000Z");
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

const ITEM = {
  id: "it-1", productId: null, nombre: "Digitalización VHS", descripcion: null, cantidad: 2, precioUnitario: 15000,
  descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false,
};

function pedido(id: string, datos: Record<string, unknown> = {}) {
  const totales = calcularTotales([ITEM as never], null);
  B.agregar("fotofficePedido", {
    id, workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", status: "EN_CURSO",
    items: [ITEM], totals: { ...totales, descuento: null }, totalArs: "30000.00", ...datos,
  });
  B.agregar("fotofficePedidoCuota", { id: `${id}-c1`, workspaceId: "ws-1", pedidoId: id, position: 1, dueDate: new Date("2026-10-01T00:00:00.000Z"), amountArs: "15000.00" });
  B.agregar("fotofficePedidoCuota", { id: `${id}-c2`, workspaceId: "ws-1", pedidoId: id, position: 2, dueDate: new Date("2026-11-01T00:00:00.000Z"), amountArs: "15000.00" });
}

const cargo = (extra: Partial<Parameters<typeof CA.agregarCargoAlPedido>[0]> = {}) =>
  CA.agregarCargoAlPedido({ workspaceId: "ws-1", pedidoId: "ped-1", concepto: "Descarga extra · Cassette 1", montoArs: 3750, origen: "digitalizacion:DESCARGA_EXTRA", ahora: AHORA, ...extra });

const fila = (id = "ped-1") => B.datos.fotofficePedido.find((p) => p.id === id)!;
const cuotas = (id = "ped-1") => B.datos.fotofficePedidoCuota.filter((c) => c.pedidoId === id).sort((a, b) => (a.position as number) - (b.position as number));

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  pedido("ped-1");
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errores.mockRestore());

describe("agregarCargoAlPedido", () => {
  it("suma un renglón al final, sube el total y crea la cuota que vence hoy en Argentina", async () => {
    const r = await cargo();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = fila();
    expect(p.totalArs).toBe("33750.00");
    const items = p.items as Record<string, unknown>[];
    expect(items).toHaveLength(2);
    expect(items[0]!.id).toBe("it-1");
    expect(items[1]).toMatchObject({ id: `cargo-${r.cuotaId}`, nombre: "Descarga extra · Cassette 1", cantidad: 1, precioUnitario: 3750, modoPrecio: "LISTA", productId: null, origen: "digitalizacion:DESCARGA_EXTRA" });
    // El renglón se lee igual que los del alta: `validarItems` no descarta la lista.
    expect(itemsGuardados(p.items)).toHaveLength(2);
    const t = p.totals as { total: number; subtotal: number; renglones: Record<string, { neto: number }> };
    expect(t.total).toBe(33750);
    expect(t.subtotal).toBe(33750);
    expect(t.renglones[`cargo-${r.cuotaId}`]!.neto).toBe(3750);
    const cs = cuotas();
    expect(cs.map((c) => c.position)).toEqual([1, 2, 3]);
    expect(cs[2]).toMatchObject({ id: r.cuotaId, amountArs: "3750.00" });
    expect((cs[2]!.dueDate as Date).toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("el vencimiento es el día de Argentina aunque en UTC ya sea mañana", async () => {
    const r = await cargo({ ahora: NOCHE });
    if (!r.ok) throw new Error(r.error);
    expect((cuotas()[2]!.dueDate as Date).toISOString()).toBe("2026-10-22T00:00:00.000Z");
  });

  it("la suma de las cuotas sigue siendo el total: editarPlan acepta el plan tal como quedó", async () => {
    await cargo();
    await cargo({ montoArs: 15000, concepto: "Extensión 30 días" });
    const plan = (await PL.planesDe("ws-1", ["ped-1"])).get("ped-1")!;
    const total = PL.pesosDeBase(fila().totalArs as string);
    expect(total).toBe(48750);
    expect(validarPlan(plan.cuotas, total)).toEqual({ ok: true });
    const editado = await PL.editarPlan(DUENO, "ped-1", plan.cuotas.map((c) => ({ id: c.id, dueDate: c.dueDate, amountArs: c.amountArs })));
    expect(editado).toEqual({ ok: true });
  });

  it("sube el saldo del pedido", async () => {
    const antes = await saldoDelPedido(B.prisma as never, "ws-1", "ped-1");
    await cargo();
    const despues = await saldoDelPedido(B.prisma as never, "ws-1", "ped-1");
    expect(despues!.saldoMinor - antes!.saldoMinor).toBe(375000);
  });

  it("un pedido COMPLETADO acepta el cargo y sigue COMPLETADO; uno CANCELADO no", async () => {
    fila().status = "COMPLETADO";
    expect((await cargo()).ok).toBe(true);
    expect(fila().status).toBe("COMPLETADO");
    fila().status = "CANCELADO";
    expect(await cargo()).toEqual({ ok: false, error: CA.MENSAJES_CARGO.cancelado });
  });

  it("rechaza importes y conceptos inválidos sin escribir nada", async () => {
    for (const montoArs of [0, -5, 10.005, Number.NaN]) expect(await cargo({ montoArs })).toEqual({ ok: false, error: CA.MENSAJES_CARGO.monto });
    expect(await cargo({ concepto: "  " })).toEqual({ ok: false, error: CA.MENSAJES_CARGO.concepto });
    expect(await cargo({ pedidoId: "otro" })).toEqual({ ok: false, error: CA.MENSAJES_CARGO.noExiste });
    expect(fila().totalArs).toBe("30000.00");
    expect(cuotas()).toHaveLength(2);
  });

  it("toma el candado del pedido", async () => {
    await cargo();
    expect(B.sql.some((s) => s.texto.includes("pg_advisory_xact_lock") && s.valores[0] === "fotoffice-pedido:ped-1")).toBe(true);
  });

  it("un pedido migrado con totales vacíos no inventa totales", async () => {
    fila().totals = {};
    const r = await cargo();
    expect(r.ok).toBe(true);
    expect(fila().totals).toEqual({});
    expect(fila().totalArs).toBe("33750.00");
  });
});

describe("quitarCargoDelPedido", () => {
  const quitar = (cuotaId: string, montoArs = 3750) => CA.quitarCargoDelPedido({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId, montoArs, concepto: "Descarga extra" });

  it("deja el pedido como estaba", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    const r2 = await cargo({ montoArs: 500 });
    if (!r2.ok) throw new Error(r2.error);
    expect(await quitar(r.cuotaId)).toEqual({ ok: true });
    const p = fila();
    expect(p.totalArs).toBe("30500.00");
    expect((p.items as unknown[]).map((i) => (i as { id: string }).id)).toEqual(["it-1", `cargo-${r2.cuotaId}`]);
    expect((p.totals as { total: number }).total).toBe(30500);
    // La cuota de después sube un lugar.
    expect(cuotas().map((c) => [c.id, c.position])).toEqual([["ped-1-c1", 1], ["ped-1-c2", 2], [r2.cuotaId, 3]]);
  });

  it("no se quita un cargo con un cobro imputado, aunque esté anulado", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: "cob-anulado", cuotaId: r.cuotaId, amountArs: "100.00" });
    expect(await quitar(r.cuotaId)).toMatchObject({ ok: false, motivo: "CON_COBROS" });
    expect(fila().totalArs).toBe("33750.00");
  });

  it("si el plan se editó a mano (la cuota del cargo vale otra cosa) no borra deuda ajena y deja una tarea", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    // Alguien juntó la cuota 2 con la del cargo: ahora vale 18.750.
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id !== "ped-1-c2");
    B.datos.fotofficePedidoCuota.find((c) => c.id === r.cuotaId)!.amountArs = "18750.00";
    expect(await quitar(r.cuotaId)).toEqual({ ok: false, motivo: "PLAN_EDITADO", error: CA.MENSAJES_CARGO.planEditado });
    expect(fila().totalArs).toBe("33750.00");
    expect(cuotas()).toHaveLength(2);
    const tareas = B.datos.fotofficePedidoTarea.map((t) => t.title);
    expect(tareas).toEqual(["Revisá el cargo «Descarga extra»: el plan se editó a mano y el sistema no lo tocó."]);
    // Una sola tarea aunque se intente de nuevo.
    await quitar(r.cuotaId);
    expect(B.datos.fotofficePedidoTarea).toHaveLength(1);
  });

  it("si el renglón no está o no coincide, no toca el total ni los totals", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    fila().items = (fila().items as { id: string }[]).filter((i) => i.id === "it-1");
    expect(await quitar(r.cuotaId)).toMatchObject({ ok: false, motivo: "PLAN_EDITADO" });
    expect(fila().totalArs).toBe("33750.00");
    expect((fila().totals as { total: number }).total).toBe(33750);
  });

  it("con el monto equivocado no quita nada", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    expect(await quitar(r.cuotaId, 1000)).toMatchObject({ ok: false, motivo: "PLAN_EDITADO" });
  });
});

describe("cambiar el importe de un cargo en el lugar", () => {
  const cambiar = (cuotaId: string, montoNuevoArs: number) =>
    enTransaccion((tx: never) => CA.cambiarMontoDelCargoEnTransaccion(tx, { workspaceId: "ws-1", pedidoId: "ped-1", cuotaId, montoArs: 3750, montoNuevoArs }));

  it("misma cuota y mismo renglón, con total, totals y cuota al nuevo importe", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    expect(await cambiar(r.cuotaId, 9000)).toEqual({ ok: true });
    expect(cuotas()[2]).toMatchObject({ id: r.cuotaId, amountArs: "9000.00" });
    expect((fila().items as { precioUnitario: number }[])[1]!.precioUnitario).toBe(9000);
    expect(fila().totalArs).toBe("39000.00");
    expect((fila().totals as { total: number; renglones: Record<string, { neto: number }> })).toMatchObject({ total: 39000, renglones: { [`cargo-${r.cuotaId}`]: { neto: 9000 } } });
  });

  it("con un cobro o una transferencia esperada, no lo cambia", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.agregar("fotofficeEsperaPago", { workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: r.cuotaId, importeEsperadoArs: "3750.00", estado: "ESPERANDO" });
    expect(await cambiar(r.cuotaId, 9000)).toMatchObject({ ok: false, motivo: "CON_COBROS" });
    expect(fila().totalArs).toBe("33750.00");
  });
});

describe("saldo sin extras opcionales", () => {
  /** Paga el pedido original entero (un cobro vigente a cada cuota del plan). */
  function pagarPlan() {
    for (const id of ["ped-1-c1", "ped-1-c2"]) {
      B.agregar("fotofficeCobro", { id: `cob-${id}`, workspaceId: "ws-1", pedidoId: "ped-1", amountArs: 15000, voidedAt: null, receiptNumber: id, receiptTokenHash: id });
      B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: `cob-${id}`, cuotaId: id, amountArs: "15000.00" });
    }
  }

  it("un extra sin pagar no cuenta para los videos ni para entregar el trabajo, en cualquier estado del cargo", async () => {
    pagarPlan();
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    for (const estado of ["PENDIENTE", "APLICADO", "ANULADO"]) {
      B.datos.digitalizacionCargo = [];
      B.agregar("digitalizacionCargo", { workspaceId: "ws-1", entregaId: "e1", pedidoId: "ped-1", cuotaId: r.cuotaId, tipo: "EXTENSION", montoArs: "3750.00", estado });
      expect((await saldoDelPedido(B.prisma as never, "ws-1", "ped-1"))!.saldoMinor).toBe(375000);
      expect((await saldoSinExtrasOpcionales(B.prisma as never, "ws-1", "ped-1"))!.saldoMinor).toBe(0);
    }
    B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    const candado = await enTransaccion((tx: never) => exigirPedidoPagado(tx, "ws-1", { subjectType: "PROYECTO", subjectId: "pro-1" }));
    expect(candado).toBeNull();
  });

  it("la deuda del plan sigue contando", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.agregar("digitalizacionCargo", { workspaceId: "ws-1", entregaId: "e1", pedidoId: "ped-1", cuotaId: r.cuotaId, tipo: "EXTENSION", montoArs: "3750.00", estado: "PENDIENTE" });
    expect((await saldoSinExtrasOpcionales(B.prisma as never, "ws-1", "ped-1"))!.saldoMinor).toBe(3000000);
  });
});

describe("transferencia anunciada", () => {
  it("una transferencia esperada abierta frena también quitar el cargo", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.agregar("fotofficeEsperaPago", { workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: r.cuotaId, importeEsperadoArs: "3750.00", estado: "ESPERANDO" });
    expect(await CA.quitarCargoDelPedido({ workspaceId: "ws-1", pedidoId: "ped-1", cuotaId: r.cuotaId, montoArs: 3750 })).toMatchObject({ ok: false, motivo: "CON_COBROS" });
    expect(cuotas()).toHaveLength(3);
  });
});

describe("tarea a revisar", () => {
  it("dice si la creó: la segunda vez no", async () => {
    expect(await CA.avisarCargoParaRevisar("ws-1", "ped-1", "Envío")).toBe(true);
    expect(await CA.avisarCargoParaRevisar("ws-1", "ped-1", "Envío")).toBe(false);
    expect(await CA.hayRevisionAbierta("ws-1", "ped-1", "Envío")).toBe(true);
  });
});

describe("quitar del pedido a mano", () => {
  const aMano = (cuotaId: string) => enTransaccion((tx: never) => CA.quitarCargoAManoEnTransaccion(tx, { workspaceId: "ws-1", pedidoId: "ped-1", cuotaId }));

  it("con la cuota borrada: saca el renglón y su monto del total y avisa que hay que ajustar el plan", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    // Plan rehecho a mano: la plata del cargo se repartió en la cuota 2.
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id !== r.cuotaId);
    B.datos.fotofficePedidoCuota.find((c) => c.id === "ped-1-c2")!.amountArs = "18750.00";
    expect(await aMano(r.cuotaId)).toEqual({ ok: true, montoArs: 3750, planCuadra: false });
    expect(fila().totalArs).toBe("30000.00");
    expect((fila().totals as { total: number }).total).toBe(30000);
    expect((fila().items as unknown[]).length).toBe(1);
  });

  it("con la cuota agrandada a mano y sin cobros: le descuenta el precio y el plan cuadra", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.datos.fotofficePedidoCuota = B.datos.fotofficePedidoCuota.filter((c) => c.id !== "ped-1-c2");
    B.datos.fotofficePedidoCuota.find((c) => c.id === r.cuotaId)!.amountArs = "18750.00";
    expect(await aMano(r.cuotaId)).toEqual({ ok: true, montoArs: 3750, planCuadra: true });
    expect(B.datos.fotofficePedidoCuota.find((c) => c.id === r.cuotaId)!.amountArs).toBe("15000.00");
  });

  it("con cobros imputados no se puede", async () => {
    const r = await cargo();
    if (!r.ok) throw new Error(r.error);
    B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: "cob-1", cuotaId: r.cuotaId, amountArs: "100.00" });
    expect(await aMano(r.cuotaId)).toEqual({ ok: false, error: CA.MENSAJES_CARGO.conCobros });
    expect(fila().totalArs).toBe("33750.00");
  });
});
