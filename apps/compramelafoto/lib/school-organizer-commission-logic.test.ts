import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRequestPayoutWhere,
  buildSchoolPortalCommissionWhere,
  buildSchoolPortalOrderWhere,
  buildSchoolPortalPreCompraWhere,
  canMarkCommissionPaid,
  classifyOrderStatus,
  classifyPreCompraOrder,
  COMMISSION_STATUSES_CANCELLED_ON_REVERSAL,
  computeOrganizerCommissionDraft,
  decideCommissionOnOrderReversal,
  isCommissionPaidThenCancelled,
  isCommissionRequestableBy,
  summarizeOrganizerCommissions,
} from "@/lib/school-organizer-commission-logic";

describe("comisión escolar — cálculo (montos en pesos, no centavos)", () => {
  it("pago confirmado → PENDING con importe sobre (total − plataforma)", () => {
    const d = computeOrganizerCommissionDraft({
      orderStatus: "PAID",
      totalCents: 12000, // $12.000
      platformCommissionCents: 2000, // $2.000
      percentage: 10,
    });
    assert.deepEqual(d, { baseAmount: 10000, amount: 1000, percentage: 10, status: "PENDING" });
  });

  it("redondea al peso", () => {
    const d = computeOrganizerCommissionDraft({
      orderStatus: "PAID",
      totalCents: 1005,
      platformCommissionCents: 0,
      percentage: 15,
    });
    assert.equal(d?.amount, 151); // 150,75 → 151
  });

  it("pedido no pagado → no genera comisión", () => {
    for (const status of ["PENDING", "CANCELED", "FAILED", "REFUNDED"]) {
      assert.equal(
        computeOrganizerCommissionDraft({
          orderStatus: status,
          totalCents: 10000,
          platformCommissionCents: 0,
          percentage: 10,
        }),
        null,
        status
      );
    }
  });

  it("porcentaje 0 / nulo o base nula → sin comisión", () => {
    assert.equal(
      computeOrganizerCommissionDraft({ orderStatus: "PAID", totalCents: 1000, platformCommissionCents: 0, percentage: 0 }),
      null
    );
    assert.equal(
      computeOrganizerCommissionDraft({ orderStatus: "PAID", totalCents: 1000, platformCommissionCents: 0, percentage: null }),
      null
    );
    assert.equal(
      computeOrganizerCommissionDraft({ orderStatus: "PAID", totalCents: 1000, platformCommissionCents: 1500, percentage: 10 }),
      null
    );
  });
});

describe("comisión escolar — totales por estado", () => {
  const rows = [
    { status: "PENDING", amount: 100, paidAt: null },
    { status: "REQUESTED", amount: 200, paidAt: null },
    { status: "PAID", amount: 300, paidAt: new Date("2026-09-01T12:00:00Z") },
    { status: "CANCELLED", amount: 400, paidAt: null },
    { status: "REJECTED", amount: 500, paidAt: null },
    { status: "CANCELLED", amount: 600, paidAt: new Date("2026-09-02T12:00:00Z") },
  ];

  it("el beneficio vigente ignora CANCELLED y REJECTED", () => {
    const t = summarizeOrganizerCommissions(rows);
    assert.equal(t.beneficioVigente, 600);
    assert.equal(t.acumulado, 600);
    assert.equal(t.pendiente, 100);
    assert.equal(t.solicitado, 200);
    assert.equal(t.pagado, 300);
  });

  it("separa anuladas, rechazadas y a compensar", () => {
    const t = summarizeOrganizerCommissions(rows);
    assert.equal(t.cancelado, 400);
    assert.equal(t.rechazado, 500);
    assert.equal(t.aCompensar, 600);
  });

  it("sin filas → todo en cero", () => {
    const t = summarizeOrganizerCommissions([]);
    assert.equal(t.beneficioVigente, 0);
    assert.equal(t.aCompensar, 0);
  });
});

describe("comisión escolar — reembolso / anulación de la venta", () => {
  it("comisión no pagada → CANCELLED y sale del beneficio vigente", () => {
    for (const status of ["PENDING", "REQUESTED"]) {
      assert.deepEqual(decideCommissionOnOrderReversal({ status }), { action: "cancel", compensate: false });
    }
    const after = summarizeOrganizerCommissions([{ status: "CANCELLED", amount: 1000, paidAt: null }]);
    assert.equal(after.beneficioVigente, 0);
    assert.equal(after.cancelado, 1000);
    assert.equal(after.aCompensar, 0);
  });

  it("comisión ya pagada → CANCELLED a compensar, conservando la traza del pago", () => {
    assert.deepEqual(decideCommissionOnOrderReversal({ status: "PAID" }), { action: "cancel", compensate: true });
    // Simula la escritura real: sólo cambia status; paidAt / medio / comprobante quedan.
    const before = {
      status: "PAID",
      amount: 1000,
      paidAt: new Date("2026-09-10T15:00:00Z"),
      paymentMethod: "Transferencia",
      paymentProofUrl: "https://example.com/comprobante.pdf",
    };
    const after = { ...before, status: "CANCELLED" };
    assert.equal(isCommissionPaidThenCancelled(after), true);
    assert.equal(after.paymentMethod, "Transferencia");
    assert.equal(after.paymentProofUrl, "https://example.com/comprobante.pdf");
    const t = summarizeOrganizerCommissions([after]);
    assert.equal(t.aCompensar, 1000);
    assert.equal(t.beneficioVigente, 0);
    assert.equal(t.pagado, 0);
  });

  it("ya anulada o rechazada → sin cambios", () => {
    assert.equal(decideCommissionOnOrderReversal({ status: "CANCELLED" }).action, "noop");
    assert.equal(decideCommissionOnOrderReversal({ status: "REJECTED" }).action, "noop");
  });

  it("los estados que la reversión anula son PENDING, REQUESTED y PAID", () => {
    assert.deepEqual([...COMMISSION_STATUSES_CANCELLED_ON_REVERSAL].sort(), ["PAID", "PENDING", "REQUESTED"]);
  });

  it("no se puede marcar pagada una comisión anulada ni rechazada", () => {
    assert.equal(canMarkCommissionPaid("CANCELLED"), false);
    assert.equal(canMarkCommissionPaid("REJECTED"), false);
    assert.equal(canMarkCommissionPaid("PENDING"), false);
    assert.equal(canMarkCommissionPaid("PAID"), false);
    assert.equal(canMarkCommissionPaid("REQUESTED"), true);
  });
});

describe("portal del colegio — aislamiento por escuela", () => {
  it("el where de comisiones siempre fija el schoolId pedido y nada más", () => {
    assert.deepEqual(buildSchoolPortalCommissionWhere(42), { schoolId: 42 });
  });

  it("los where de pre-compras y pedidos incluyen schoolId y excluyen pruebas", () => {
    const pc = buildSchoolPortalPreCompraWhere(42, [1, 2]);
    assert.equal(pc.album.schoolId, 42);
    assert.equal(pc.isTest, false);
    const o = buildSchoolPortalOrderWhere(42, [1, 2]);
    assert.equal(o.album.schoolId, 42);
    assert.equal(o.isTest, false);
  });

  it("aunque la lista de álbumes venga vacía, el schoolId sigue en el filtro", () => {
    assert.equal(buildSchoolPortalPreCompraWhere(7, []).album.schoolId, 7);
    assert.equal(buildSchoolPortalOrderWhere(7, []).album.schoolId, 7);
  });

  it("schoolId inválido → error (nunca un where sin escuela)", () => {
    for (const bad of [0, -1, Number.NaN, 1.5]) {
      assert.throws(() => buildSchoolPortalCommissionWhere(bad));
      assert.throws(() => buildSchoolPortalOrderWhere(bad, [1]));
    }
  });

  it("solicitar cobro: siempre por schoolId y sólo PENDING; no toca las de otro organizador activo", () => {
    const w = buildRequestPayoutWhere({ schoolId: 42, userId: 10, activeOrganizerUserIds: [10, 11] });
    assert.equal(w.schoolId, 42);
    assert.equal(w.status, "PENDING");
    assert.deepEqual(w.OR, [{ organizerUserId: null }, { organizerUserId: { notIn: [11] } }]);

    const solo = buildRequestPayoutWhere({ schoolId: 42, userId: 10, activeOrganizerUserIds: [10] });
    assert.deepEqual(solo, { schoolId: 42, status: "PENDING" });

    const ctx = { userId: 10, activeOrganizerUserIds: [10, 11] };
    assert.equal(isCommissionRequestableBy({ status: "PENDING", organizerUserId: 10 }, ctx), true);
    assert.equal(isCommissionRequestableBy({ status: "PENDING", organizerUserId: null }, ctx), true);
    assert.equal(isCommissionRequestableBy({ status: "PENDING", organizerUserId: 99 }, ctx), true); // ex organizador
    assert.equal(isCommissionRequestableBy({ status: "PENDING", organizerUserId: 11 }, ctx), false);
    assert.equal(isCommissionRequestableBy({ status: "PAID", organizerUserId: 10 }, ctx), false);
  });
});

describe("portal del colegio — clasificación de operaciones", () => {
  it("Order: pagadas / pendientes / canceladas / reembolsadas", () => {
    assert.equal(classifyOrderStatus("PAID"), "pagadas");
    assert.equal(classifyOrderStatus("PENDING"), "pendientes");
    assert.equal(classifyOrderStatus("CANCELED"), "canceladas");
    assert.equal(classifyOrderStatus("FAILED"), "canceladas");
    assert.equal(classifyOrderStatus("REFUNDED"), "reembolsadas");
  });

  it("pre-compra: el Order de preventa asociado manda (reembolso)", () => {
    assert.equal(classifyPreCompraOrder({ status: "PAID_HELD" }), "pagadas");
    assert.equal(classifyPreCompraOrder({ status: "CREATED" }), "pendientes");
    assert.equal(classifyPreCompraOrder({ status: "CANCELED" }), "canceladas");
    assert.equal(classifyPreCompraOrder({ status: "CANCELED", linkedOrderStatus: "REFUNDED" }), "reembolsadas");
    assert.equal(classifyPreCompraOrder({ status: "CREATED", linkedOrderStatus: "PENDING" }), "pendientes");
    assert.equal(classifyPreCompraOrder({ status: "CREATED", linkedOrderStatus: "PAID" }), "pagadas");
  });
});
