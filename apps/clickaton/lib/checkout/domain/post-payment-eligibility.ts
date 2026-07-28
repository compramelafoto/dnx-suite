/**
 * Check-in eligibility after DNX Payments confirmation (10D3I-H).
 * Does not perform check-in — only gates.
 */
export type CheckInEligibilityInput = {
  registrationStatus: string;
  paymentStatus: string;
  hasActiveCredential: boolean;
  alreadyCheckedIn: boolean;
};

export type CheckInEligibilityResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "NOT_CONFIRMED"
        | "PAYMENT_NOT_APPROVED"
        | "CREDENTIAL_MISSING"
        | "ALREADY_CHECKED_IN";
    };

export function evaluateCheckInEligibility(
  input: CheckInEligibilityInput,
): CheckInEligibilityResult {
  if (input.registrationStatus !== "CONFIRMED") {
    return { ok: false, reason: "NOT_CONFIRMED" };
  }
  if (input.paymentStatus !== "APPROVED" && input.paymentStatus !== "NOT_REQUIRED") {
    return { ok: false, reason: "PAYMENT_NOT_APPROVED" };
  }
  if (!input.hasActiveCredential) {
    return { ok: false, reason: "CREDENTIAL_MISSING" };
  }
  if (input.alreadyCheckedIn) {
    return { ok: false, reason: "ALREADY_CHECKED_IN" };
  }
  return { ok: true };
}

/** Kit eligibility after paid: stock holds consumed + registration confirmed. */
export function evaluateKitEligibility(input: {
  registrationStatus: string;
  paymentStatus: string;
  stockHoldsConsumed: boolean;
}): { ok: true; state: "ELIGIBLE" } | { ok: false; reason: string } {
  if (
    input.registrationStatus !== "CONFIRMED" ||
    (input.paymentStatus !== "APPROVED" && input.paymentStatus !== "NOT_REQUIRED")
  ) {
    return { ok: false, reason: "NOT_PAID" };
  }
  if (!input.stockHoldsConsumed) {
    return { ok: false, reason: "HOLDS_NOT_CONSUMED" };
  }
  return { ok: true, state: "ELIGIBLE" };
}
