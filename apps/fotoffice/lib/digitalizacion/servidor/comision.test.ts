import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./comision");
const { pendingFeeDebtMinor } = await import("@/lib/platform-fee/ledger");

const AHORA = new Date("2026-10-25T15:00:00.000Z");
const PAGADO = new Date("2026-10-24T15:00:00.000Z");
const asientos = () => B.datos.workspaceFeeLedgerEntry;
const marcas = () => B.datos.digitalizacionComision;
/** Una transacción de la base en memoria (como la del cobro). */
const enTx = (fn: (tx: never) => Promise<void>) =>
  (B.prisma as unknown as { $transaction: (f: (tx: never) => Promise<void>) => Promise<void> }).$transaction(fn);

function cobro(id: string, monto: number, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeCobro", {
    id, workspaceId: "ws-1", pedidoId: "ped-1", clientId: "cli-1", amountArs: monto.toFixed(2), voidedAt: null,
    receiptNumber: `R-${id}`, receiptTokenHash: `h-${id}`, providerPaymentRef: null, method: "EFECTIVO", paidAt: PAGADO, createdAt: PAGADO, ...extra,
  });
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  B.agregar("workspaceModuleFee", { workspaceId: "ws-1", moduleKey: "digitalizacion", feeBps: 500 });
  B.agregar("workspaceModuleFee", { workspaceId: "ws-dnx", moduleKey: "digitalizacion", feeBps: 0 });
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "cli-1", status: "EN_CURSO", totalArs: "30000.00" });
  B.agregar("fotofficeProyecto", { id: "pro-1", workspaceId: "ws-1", pedidoId: "ped-1", number: "T-1", name: "Digitalización" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errores.mockRestore());

describe("qué pedido es de digitalización", () => {
  it("el que tiene entrega, o un trabajo con grabaciones no descartadas", async () => {
    expect(await C.esPedidoDeDigitalizacion("ws-1", "ped-1")).toBe(false);
    B.agregar("digitalizacionGrabacion", { id: "g-1", workspaceId: "ws-1", proyectoId: "pro-1", estado: "DESCARTADA" });
    expect(await C.esPedidoDeDigitalizacion("ws-1", "ped-1")).toBe(false);
    B.agregar("digitalizacionGrabacion", { id: "g-2", workspaceId: "ws-1", proyectoId: "pro-1", estado: "GRABANDO" });
    expect(await C.esPedidoDeDigitalizacion("ws-1", "ped-1")).toBe(true);
    expect(await C.esPedidoDeDigitalizacion("ws-2", "ped-1")).toBe(false);
    B.datos.digitalizacionGrabacion.length = 0;
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    expect(await C.esPedidoDeDigitalizacion("ws-1", "ped-1")).toBe(true);
  });
});

describe("devengar los cobros del pedido", () => {
  it("un pedido que no es de digitalización no devenga", async () => {
    cobro("c-1", 10000);
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
    expect(asientos()).toHaveLength(0);
  });

  it("devenga el 5 % de cada cobro vigente, una sola vez, con la marca", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("c-1", 10000);
    cobro("c-2", 20000.1);
    cobro("c-3", 5000, { voidedAt: AHORA });
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(2);
    expect(asientos().map((a) => [a.kind, a.amountArs])).toEqual([["DEVENGADO", "500.00"], ["DEVENGADO", "1000.01"]]);
    expect(asientos()[0]!.note).toBe("Comisión 5 % · pedido 2026-0001 · recibo R-c-1 · 500 pesos");
    expect(marcas().map((m) => [m.cobroId, m.ledgerEntryId])).toEqual([["c-1", asientos()[0]!.id], ["c-2", asientos()[1]!.id]]);
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
    expect(asientos()).toHaveLength(2);
    expect(await pendingFeeDebtMinor("ws-1")).toBe(150_001);
  });

  it("sólo los cobros pagados desde el 23/10 (00:00 de Argentina)", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("viejo", 10000, { paidAt: new Date("2026-10-23T02:59:00Z") });
    cobro("nuevo", 10000, { paidAt: new Date("2026-10-23T03:00:00Z") });
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(1);
    expect(marcas().map((m) => m.cobroId)).toEqual(["nuevo"]);
  });

  it("si la base no deja leer la tasa, no devenga nada (no supone el 5 %)", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("c-1", 10000);
    const original = B.tablas.workspaceModuleFee.findUnique;
    B.tablas.workspaceModuleFee.findUnique = async () => {
      throw new Error("se cayó la base");
    };
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
    expect(await C.tasaDeDigitalizacion("ws-1")).toBeNull();
    B.tablas.workspaceModuleFee.findUnique = original;
    expect(asientos()).toHaveLength(0);
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(1);
  });

  it("con 0 bps (DNX) no hace nada", async () => {
    B.datos.fotofficePedido[0]!.workspaceId = "ws-dnx";
    B.datos.fotofficeProyecto[0]!.workspaceId = "ws-dnx";
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-dnx", pedidoId: "ped-1" });
    cobro("c-1", 10000, { workspaceId: "ws-dnx" });
    expect(await C.devengarComisionesDelPedido("ws-dnx", "ped-1")).toBe(0);
    expect(asientos()).toHaveLength(0);
  });

  it("si otro lo marcó en el medio, su asiento se deshace", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("c-1", 10000);
    const original = B.tablas.digitalizacionComision.create;
    B.tablas.digitalizacionComision.create = async () => {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    };
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
    B.tablas.digitalizacionComision.create = original;
    expect(asientos()).toHaveLength(0);
    expect(errores).not.toHaveBeenCalled();
  });
});

describe("retención de Mercado Pago dentro del cobro", () => {
  it("asienta sólo la parte de deuda (acotada a la deuda de ese momento) y marca el cobro", async () => {
    B.agregar("workspaceFeeLedgerEntry", { id: "deuda", workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "150.00" });
    cobro("c-mp", 10000, { method: "MERCADO_PAGO", providerPaymentRef: "pay-1" });
    await enTx((tx) =>
      C.retenerEnTx(tx as never, { workspaceId: "ws-1", pedidoId: "ped-1", cobroId: "c-mp", reciboNumero: "R-c-mp", retencion: { propioMinor: 50_000, retenidoMinor: 70_000 }, bps: 500 }),
    );
    const ret = asientos().find((a) => a.kind === "RETENIDO")!;
    expect(ret.amountArs).toBe("-150.00");
    expect(ret.note).toBe("Comisión 5 % retenida por Mercado Pago · pedido 2026-0001 · recibo R-c-mp · 700 pesos (500 pesos de este cobro y 150 pesos de deuda)");
    expect(marcas()).toEqual([expect.objectContaining({ cobroId: "c-mp", ledgerEntryId: ret.id })]);
    expect(await pendingFeeDebtMinor("ws-1")).toBe(0);
  });

  it("sin deuda, el asiento es de 0 pesos: sólo marca el cobro (después no se devenga)", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("c-mp", 10000, { method: "MERCADO_PAGO", providerPaymentRef: "pay-1" });
    await enTx((tx) =>
      C.retenerEnTx(tx as never, { workspaceId: "ws-1", pedidoId: "ped-1", cobroId: "c-mp", reciboNumero: "R-c-mp", retencion: { propioMinor: 50_000, retenidoMinor: 50_000 }, bps: 500 }),
    );
    expect(asientos().map((a) => [a.kind, a.amountArs])).toEqual([["RETENIDO", "0.00"]]);
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
  });
});

describe("anular un cobro con comisión devengada", () => {
  beforeEach(() => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
  });

  it("asienta el reverso en negativo, la marca apunta al reverso y no se vuelve a devengar ni a revertir", async () => {
    cobro("c-1", 10000);
    await C.devengarComisionesDelPedido("ws-1", "ped-1");
    expect(await C.revertirComisionDelCobro("ws-1", "c-1")).toBe(false); // todavía vigente
    B.datos.fotofficeCobro[0]!.voidedAt = AHORA;
    expect(await C.revertirComisionDelCobro("ws-1", "c-1")).toBe(true);
    const rev = asientos().find((a) => a.kind === "REVERSADO")!;
    expect(rev.amountArs).toBe("-500.00");
    expect(rev.note).toBe("Cobro anulado: se revierte la comisión devengada · pedido 2026-0001 · recibo R-c-1 · 500 pesos");
    expect(marcas()[0]!.ledgerEntryId).toBe(rev.id);
    expect(await pendingFeeDebtMinor("ws-1")).toBe(0);
    expect(await C.revertirComisionDelCobro("ws-1", "c-1")).toBe(false);
    expect(await C.devengarComisionesDelPedido("ws-1", "ped-1")).toBe(0);
    expect(asientos()).toHaveLength(2);
  });

  it("el reverso se acota a la deuda pendiente: el saldo nunca queda negativo", async () => {
    cobro("c-1", 10000);
    await C.devengarComisionesDelPedido("ws-1", "ped-1");
    // Un pago de Mercado Pago ya cobró 300 de esos 500 pesos de deuda.
    B.agregar("workspaceFeeLedgerEntry", { workspaceId: "ws-1", kind: "RETENIDO", amountArs: "-300.00" });
    B.datos.fotofficeCobro[0]!.voidedAt = AHORA;
    expect(await C.revertirComisionDelCobro("ws-1", "c-1")).toBe(true);
    const rev = asientos().find((a) => a.kind === "REVERSADO")!;
    expect(rev.amountArs).toBe("-200.00");
    expect(rev.note).toContain("300 pesos no se revirtieron: esa deuda ya se había cobrado");
    expect(await pendingFeeDebtMinor("ws-1")).toBe(0);
    const suma = asientos().reduce((s, a) => s + Math.round(Number(a.amountArs) * 100), 0);
    expect(suma).toBe(0);
  });

  it("una retención de Mercado Pago no se revierte al anular", async () => {
    cobro("c-mp", 10000, { providerPaymentRef: "pay-1", voidedAt: AHORA });
    await enTx((tx) =>
      C.retenerEnTx(tx as never, { workspaceId: "ws-1", pedidoId: "ped-1", cobroId: "c-mp", reciboNumero: "R", retencion: { propioMinor: 500, retenidoMinor: 500 }, bps: 500 }),
    );
    expect(await C.revertirComisionDelCobro("ws-1", "c-mp")).toBe(false);
    expect(asientos()).toHaveLength(1);
  });
});

describe("devolución de un pago con retención", () => {
  it("REVERSADO positivo por la deuda que había cancelado; un aviso repetido no lo duplica", async () => {
    B.agregar("workspaceFeeLedgerEntry", { id: "deuda", workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "150.00" });
    cobro("c-mp", 10000, { providerPaymentRef: "pay-1" });
    await enTx((tx) =>
      C.retenerEnTx(tx, { workspaceId: "ws-1", pedidoId: "ped-1", cobroId: "c-mp", reciboNumero: "R-c-mp", retencion: { propioMinor: 50_000, retenidoMinor: 70_000 }, bps: 500 }),
    );
    expect(await pendingFeeDebtMinor("ws-1")).toBe(0);
    expect(await C.revertirRetencionDelCobro("ws-1", "c-mp", "refunded")).toBe(true);
    const rev = asientos().find((a) => a.kind === "REVERSADO")!;
    expect(rev.amountArs).toBe("150.00");
    expect(rev.note).toBe("Mercado Pago devolvió el pago (devuelto): la deuda que había cancelado vuelve a quedar pendiente · pedido 2026-0001 · recibo R-c-mp · 150 pesos");
    expect(marcas()[0]!.ledgerEntryId).toBe(rev.id);
    expect(await pendingFeeDebtMinor("ws-1")).toBe(15_000);
    expect(await C.revertirRetencionDelCobro("ws-1", "c-mp", "charged_back")).toBe(false);
    expect(asientos()).toHaveLength(3);
  });

  it("una retención de 0 pesos (sólo la propia) no tiene nada que revertir", async () => {
    cobro("c-mp", 10000, { providerPaymentRef: "pay-1" });
    await enTx((tx) =>
      C.retenerEnTx(tx, { workspaceId: "ws-1", pedidoId: "ped-1", cobroId: "c-mp", reciboNumero: "R", retencion: { propioMinor: 500, retenidoMinor: 500 }, bps: 500 }),
    );
    expect(await C.revertirRetencionDelCobro("ws-1", "c-mp", "refunded")).toBe(false);
    expect(asientos()).toHaveLength(1);
  });
});

describe("conciliación de los crons", () => {
  it("devenga los cobros sin marca de pedidos con entrega o grabaciones recientes, y revierte los anulados", async () => {
    // ped-1: con grabación reciente y sin entrega.
    B.agregar("digitalizacionGrabacion", { id: "g-1", workspaceId: "ws-1", proyectoId: "pro-1", estado: "COMPLETA", iniciadaAt: new Date("2026-10-20T12:00:00Z") });
    cobro("c-1", 10000);
    // ped-2: con entrega; un cobro devengado y después anulado sin que llegara el reverso.
    B.agregar("fotofficePedido", { id: "ped-2", workspaceId: "ws-1", number: "2026-0002", clientId: "cli-1", status: "EN_CURSO", totalArs: "1000.00" });
    B.agregar("digitalizacionEntrega", { id: "ent-2", workspaceId: "ws-1", pedidoId: "ped-2", createdAt: PAGADO });
    cobro("c-2", 1000, { pedidoId: "ped-2" });
    await C.devengarComisionesDelPedido("ws-1", "ped-2");
    B.datos.fotofficeCobro.find((c) => c.id === "c-2")!.voidedAt = AHORA;
    // ped-3: no es de digitalización.
    B.agregar("fotofficePedido", { id: "ped-3", workspaceId: "ws-1", number: "2026-0003", clientId: "cli-1", status: "EN_CURSO", totalArs: "1000.00" });
    cobro("c-3", 1000, { pedidoId: "ped-3" });

    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 1, revertidas: 1 });
    expect(marcas().map((m) => m.cobroId).sort()).toEqual(["c-1", "c-2"]);
    expect(await pendingFeeDebtMinor("ws-1")).toBe(50_000);
    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 0, revertidas: 0 });
  });

  it("no recorre el historial: cobros de antes del corte, o creados fuera de la ventana, no se miran", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1", createdAt: new Date("2026-01-01T00:00:00Z") });
    cobro("antes-del-corte", 10000, { paidAt: new Date("2026-10-20T12:00:00Z"), createdAt: new Date("2026-10-20T12:00:00Z") });
    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 0, revertidas: 0 });
    // Cuatro meses después: el cobro (del corte en adelante) ya quedó fuera de la ventana de 90 días.
    cobro("viejo", 10000);
    expect(await C.conciliarComisiones({ ahora: () => new Date("2027-03-01T12:00:00Z") })).toEqual({ devengadas: 0, revertidas: 0 });
    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 1, revertidas: 0 });
  });

  it("si la tasa no se puede leer, ese negocio queda para la próxima corrida", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1", createdAt: PAGADO });
    cobro("c-1", 10000);
    const original = B.tablas.workspaceModuleFee.findUnique;
    B.tablas.workspaceModuleFee.findUnique = async () => {
      throw new Error("se cayó la base");
    };
    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 0, revertidas: 0 });
    B.tablas.workspaceModuleFee.findUnique = original;
    expect(await C.conciliarComisiones({ ahora: () => AHORA })).toEqual({ devengadas: 1, revertidas: 0 });
  });
});

describe("resumen para la lista", () => {
  it("lo devengado este mes (sin los revertidos) y la deuda pendiente; null para DNX", async () => {
    B.agregar("digitalizacionEntrega", { id: "ent-1", workspaceId: "ws-1", pedidoId: "ped-1" });
    cobro("c-1", 10000);
    cobro("c-2", 20000);
    await C.devengarComisionesDelPedido("ws-1", "ped-1");
    B.datos.fotofficeCobro.find((c) => c.id === "c-2")!.voidedAt = AHORA;
    await C.revertirComisionDelCobro("ws-1", "c-2");
    B.agregar("workspaceFeeLedgerEntry", { workspaceId: "ws-1", kind: "DEVENGADO", amountArs: "300.00" }); // de otro módulo
    expect(await C.resumenDeComision("ws-1", new Date())).toEqual({ devengadoMesMinor: 50_000, saldoPendienteMinor: 80_000 });
    expect(await C.resumenDeComision("ws-dnx")).toBeNull();
  });
});
