/**
 * Menores: permitidos con autorización adulto.
 * Campos jurídicos definitivos → MINOR LEGAL FIELDS REVIEW REQUIRED.
 */

export type MinorGateResult =
  | { ok: true; isMinor: false }
  | {
      ok: true;
      isMinor: true;
      requiresAdultAuthorization: true;
      legalFieldsStatus: "MINOR_LEGAL_FIELDS_REVIEW_REQUIRED" | "COMPLETE";
    }
  | { ok: false; reason: "MINOR_AUTHORIZATION_MISSING" };

export function evaluateMinorGate(input: {
  birthDate: Date | null;
  eventDate: Date;
  adultName?: string | null;
  adultDocumentOrContact?: string | null;
  adultAuthorizationAcceptedAt?: Date | null;
  accompanimentConfirmed?: boolean | null;
}): MinorGateResult {
  if (!input.birthDate) {
    return { ok: true, isMinor: false };
  }
  const ageMs = input.eventDate.getTime() - input.birthDate.getTime();
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears >= 18) return { ok: true, isMinor: false };

  const hasAuth = Boolean(input.adultAuthorizationAcceptedAt);
  const hasAdultName = Boolean(input.adultName?.trim());
  if (!hasAuth || !hasAdultName) {
    return { ok: false, reason: "MINOR_AUTHORIZATION_MISSING" };
  }

  const legalComplete = Boolean(
    input.adultDocumentOrContact?.trim() && input.accompanimentConfirmed,
  );

  return {
    ok: true,
    isMinor: true,
    requiresAdultAuthorization: true,
    legalFieldsStatus: legalComplete
      ? "COMPLETE"
      : "MINOR_LEGAL_FIELDS_REVIEW_REQUIRED",
  };
}
