/**
 * Elegibilidad competitiva: mínimo N consignas con obra válida (default 8/10).
 * Incomplete no borra obras — solo excluye de jurado/ranking.
 *
 * Para contar hacia 8/10 la obra debe cumplir ventana de CAPTURA (EXIF).
 * Una foto descalificada por horario de captura NO cuenta como válida.
 */

export type CompetitiveEligibilityStatus =
  | "ELIGIBLE"
  | "INCOMPLETE"
  | "NOT_ELIGIBLE";

export type CaptureValidityForCompetitive =
  | "CAPTURE_VALID"
  | "CAPTURE_INVALID"
  | "CAPTURE_UNKNOWN";

/**
 * Cuenta consignas con envío usable hacia 8/10.
 * Solo CAPTURE_VALID cuenta; CAPTURE_INVALID / UNKNOWN no.
 */
export function countCaptureValidPrompts(
  submissions: Array<{ captureValidity: CaptureValidityForCompetitive }>,
): number {
  return submissions.filter((s) => s.captureValidity === "CAPTURE_VALID").length;
}

export function resolveCompetitiveEligibility(input: {
  validPromptCount: number;
  totalPrompts: number;
  minValidPrompts: number;
}): {
  status: CompetitiveEligibilityStatus;
  validPromptCount: number;
  minValidPrompts: number;
  juryEligible: boolean;
} {
  const min = Math.max(0, input.minValidPrompts);
  const valid = Math.max(0, input.validPromptCount);
  if (valid >= min) {
    return {
      status: "ELIGIBLE",
      validPromptCount: valid,
      minValidPrompts: min,
      juryEligible: true,
    };
  }
  return {
    status: valid === 0 ? "NOT_ELIGIBLE" : "INCOMPLETE",
    validPromptCount: valid,
    minValidPrompts: min,
    juryEligible: false,
  };
}
