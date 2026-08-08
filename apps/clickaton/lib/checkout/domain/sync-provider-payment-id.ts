/**
 * Decisión pura para persistir providerPaymentId tras reconciliación APPROVED.
 *
 * Reglas:
 * - local null + remote válido → persistir
 * - local == remote → noop
 * - local distinto → no sobrescribir; MANUAL_REVIEW
 */
export type ProviderPaymentIdSyncDecision =
  | { action: "noop"; reason: "missing_remote" | "same_id" }
  | { action: "persist"; providerPaymentId: string }
  | {
      action: "manual_review";
      reason: "provider_payment_id_conflict";
      local: string;
      remote: string;
    };

export function isValidProviderPaymentId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d+$/.test(value.trim());
}

export function decideProviderPaymentIdSync(input: {
  localProviderPaymentId: string | null | undefined;
  remoteProviderPaymentId: string | null | undefined;
}): ProviderPaymentIdSyncDecision {
  const remote = input.remoteProviderPaymentId?.trim() ?? "";
  if (!isValidProviderPaymentId(remote)) {
    return { action: "noop", reason: "missing_remote" };
  }

  const local = input.localProviderPaymentId?.trim() ?? "";
  if (!local) {
    return { action: "persist", providerPaymentId: remote };
  }
  if (local === remote) {
    return { action: "noop", reason: "same_id" };
  }
  return {
    action: "manual_review",
    reason: "provider_payment_id_conflict",
    local,
    remote,
  };
}
