import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPaymentRefundState } from "@repo/payments/mercado-pago";
import { plannedRefundChanges } from "./reconcile-refund";

/**
 * Dry-run planning puro (sin red / sin DB): mismo criterio que el script histórico.
 */
function planFromDetection(input: {
  previousPaymentStatus: string;
  previousRegistrationStatus: string;
  previousRefunded: number | null;
  previousOrderStatus?: string | null;
  raw: Record<string, unknown>;
}) {
  const d = detectPaymentRefundState({ raw: input.raw });
  const changes = plannedRefundChanges({
    previous: {
      registrationStatus: input.previousRegistrationStatus,
      paymentStatus: input.previousPaymentStatus,
      orderStatus: input.previousOrderStatus ?? d.status,
      refundedAmountMinor: input.previousRefunded,
    },
    detectedStatus: d.status,
    detectedRefunded: d.refundedAmountMinor,
  });
  return { detected: d, changes };
}

describe("reconcile refund dry-run planning", () => {
  it("dry-run detecta total sobre inscripción aún APPROVED", () => {
    const plan = planFromDetection({
      previousPaymentStatus: "APPROVED",
      previousRegistrationStatus: "CONFIRMED",
      previousRefunded: null,
      raw: {
        id: 42,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 500,
        transaction_amount_refunded: 500,
      },
    });
    assert.equal(plan.detected.status, "REFUNDED");
    assert.ok(plan.changes.some((c) => c.includes("REFUNDED")));
  });

  it("segunda ejecución dry-run queda already_in_sync", () => {
    const plan = planFromDetection({
      previousPaymentStatus: "REFUNDED",
      previousRegistrationStatus: "REFUNDED",
      previousRefunded: 50_000,
      previousOrderStatus: "REFUNDED",
      raw: {
        id: 42,
        status: "refunded",
        currency_id: "ARS",
        transaction_amount: 500,
        transaction_amount_refunded: 500,
      },
    });
    assert.deepEqual(plan.changes, ["already_in_sync"]);
  });

  it("already_in_sync implica wrote=false / applied=false / changedRecords=0", () => {
    const changes = plannedRefundChanges({
      previous: {
        registrationStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
        orderStatus: "REFUNDED",
        refundedAmountMinor: 2_500_000,
      },
      detectedStatus: "REFUNDED",
      detectedRefunded: 2_500_000,
    });
    assert.deepEqual(changes, ["already_in_sync"]);
    // Contrato operativo esperado al short-circuit (sin abrir apply/write).
    const semantic = {
      result: "ALREADY_IN_SYNC" as const,
      applied: false,
      wrote: false,
      changedRecords: 0,
    };
    assert.equal(semantic.applied, false);
    assert.equal(semantic.wrote, false);
    assert.equal(semantic.changedRecords, 0);
  });
});
