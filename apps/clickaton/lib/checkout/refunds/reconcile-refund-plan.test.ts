import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPaymentRefundState } from "@repo/payments/mercado-pago";

/**
 * Dry-run planning puro (sin red / sin DB): mismo criterio que el script histórico.
 */
function planFromDetection(input: {
  previousPaymentStatus: string;
  previousRegistrationStatus: string;
  previousRefunded: number | null;
  raw: Record<string, unknown>;
}) {
  const d = detectPaymentRefundState({ raw: input.raw });
  const changes: string[] = [];
  const payTarget =
    d.status === "REFUNDED"
      ? "REFUNDED"
      : d.status === "PARTIALLY_REFUNDED"
        ? "PARTIALLY_REFUNDED"
        : null;
  if (!payTarget) return { detected: d, changes: ["no_refund_detected"] as string[] };
  if (input.previousPaymentStatus !== payTarget) {
    changes.push(`paymentStatus→${payTarget}`);
  }
  if (d.status === "REFUNDED" && input.previousRegistrationStatus !== "REFUNDED") {
    changes.push("registrationStatus→REFUNDED");
  }
  if (input.previousRefunded !== d.refundedAmountMinor) {
    changes.push(`refundedAmountMinor→${d.refundedAmountMinor}`);
  }
  return { detected: d, changes: changes.length ? changes : ["already_in_sync"] };
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
});
