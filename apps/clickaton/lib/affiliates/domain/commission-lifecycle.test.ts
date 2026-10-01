import assert from "node:assert/strict";
import test from "node:test";

import {
  nextCommissionState,
  RECOVER_FROM_AFFILIATE_NOTE,
  REVERSED_AFTER_PAYOUT_NOTE,
} from "./commission-lifecycle";

test("pago sin reparto: PENDING → OWED con modo MANUAL", () => {
  assert.deepEqual(nextCommissionState({ status: "PENDING", mode: null }, { type: "PAID" }), {
    status: "OWED",
    mode: "MANUAL",
    setPaidAt: true,
  });
});

test("pago con reparto marcado por el checkout: PENDING → PAID_BY_SPLIT", () => {
  assert.deepEqual(nextCommissionState({ status: "PENDING", mode: "SPLIT" }, { type: "PAID" }), {
    status: "PAID_BY_SPLIT",
    mode: "SPLIT",
    setPaidAt: true,
  });
});

test("un pago repetido o tardío no cambia nada", () => {
  for (const status of ["OWED", "PAID_BY_SPLIT", "PAID_OUT", "REVERSED"] as const) {
    assert.equal(nextCommissionState({ status, mode: "MANUAL" }, { type: "PAID" }), null);
  }
});

test("reserva vencida: PENDING → REVERSED con el motivo", () => {
  assert.deepEqual(
    nextCommissionState({ status: "PENDING", mode: null }, { type: "REVERSE", reason: "reserva vencida" }),
    { status: "REVERSED", mode: null, reversalReason: "reserva vencida", setReversedAt: true },
  );
});

test("reembolso de una adeudada: OWED → REVERSED", () => {
  const change = nextCommissionState(
    { status: "OWED", mode: "MANUAL" },
    { type: "REVERSE", reason: "pago reembolsado" },
  );
  assert.equal(change?.status, "REVERSED");
  assert.equal(change?.mode, "MANUAL");
  assert.equal(change?.reversalReason, "pago reembolsado");
});

test("reembolso de una cobrada por split: avisa que hay que recuperarla", () => {
  const change = nextCommissionState(
    { status: "PAID_BY_SPLIT", mode: "SPLIT" },
    { type: "REVERSE", reason: "pago reembolsado" },
  );
  assert.equal(change?.status, "REVERSED");
  assert.equal(change?.mode, "SPLIT");
  assert.ok(change?.reversalReason?.includes(RECOVER_FROM_AFFILIATE_NOTE));
  assert.ok(change?.reversalReason?.startsWith("pago reembolsado"));
});

test("reembolso de una ya transferida: se anula pero el motivo lo dice", () => {
  const change = nextCommissionState(
    { status: "PAID_OUT", mode: "MANUAL" },
    { type: "REVERSE", reason: "pago reembolsado" },
  );
  assert.equal(change?.status, "REVERSED");
  assert.ok(change?.reversalReason?.includes(REVERSED_AFTER_PAYOUT_NOTE));
  // No pide resetear paidOut: sólo marca la reversa.
  assert.equal(change?.setPaidAt, undefined);
});

test("una anulada no se vuelve a anular", () => {
  assert.equal(
    nextCommissionState({ status: "REVERSED", mode: null }, { type: "REVERSE", reason: "x" }),
    null,
  );
});

test("un motivo vacío igual deja constancia", () => {
  const change = nextCommissionState({ status: "PENDING", mode: null }, { type: "REVERSE", reason: "  " });
  assert.equal(change?.reversalReason, "anulada");
});
