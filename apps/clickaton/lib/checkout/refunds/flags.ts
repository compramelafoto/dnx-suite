function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isTestRuntime(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  if (envTruthy(process.env.VITEST)) return true;
  if (envTruthy(process.env.CLICKATON_TEST_MODE)) return true;
  // node:test con tsx a menudo deja NODE_ENV=development
  if (typeof process.env.NODE_TEST_CONTEXT === "string") return true;
  return false;
}

/**
 * Reconciliación automática de refunds (cron).
 * Tests: activa. Staging: evaluable. Producción: off hasta validación.
 */
export function isRefundAutoReconcileEnabled(): boolean {
  if (isTestRuntime()) return true;
  return envTruthy(process.env.DNX_CLICKATON_REFUND_AUTO_RECONCILE_ENABLED);
}

/** Escrituras reales del cron de refunds (sin esto → shadow/dry). */
export function isRefundAutoReconcileWritesEnabled(): boolean {
  if (isTestRuntime()) return true;
  return envTruthy(process.env.DNX_CLICKATON_REFUND_AUTO_RECONCILE_WRITES_ENABLED);
}

export type RefundReconcileMode = "disabled" | "shadow" | "apply";

export function resolveRefundReconcileMode(): RefundReconcileMode {
  if (!isRefundAutoReconcileEnabled()) return "disabled";
  if (!isRefundAutoReconcileWritesEnabled()) return "shadow";
  return "apply";
}
