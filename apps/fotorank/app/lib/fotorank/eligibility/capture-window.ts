import type { EligibilityResult } from "./types";

/**
 * Evalúa DateTimeOriginal (u otra fecha de captura) contra la ventana del concurso.
 * Comparación en instantes UTC; las fechas de ventana ya deben estar en UTC ISO.
 * Ausencia / fuera de período → revisión manual (no auto-rechazo irreversible v1).
 */
export function evaluateCaptureWindowEligibility(input: {
  captureDate: Date | string | null | undefined;
  captureWindowStartsAt: Date | string | null | undefined;
  captureWindowEndsExclusiveAt: Date | string | null | undefined;
  timezone?: string;
}): EligibilityResult {
  const tz = input.timezone ?? "America/Argentina/Cordoba";
  const starts = toDate(input.captureWindowStartsAt);
  const endsEx = toDate(input.captureWindowEndsExclusiveAt);

  if (!starts || !endsEx) {
    return {
      decision: "MANUAL_REVIEW_REQUIRED",
      reasonCode: "CAPTURE_DATE_MISSING",
      publicMessage: "La ventana de captura del concurso no está configurada.",
      internalMessage: "capture window unset",
      evidence: { timezone: tz },
    };
  }

  const capture = toDate(input.captureDate);
  if (!capture) {
    return {
      decision: "DATE_MISSING_REVIEW",
      reasonCode: "CAPTURE_DATE_MISSING",
      publicMessage:
        "No encontramos la fecha de captura en el archivo. La organización podrá solicitar el original o más evidencia.",
      internalMessage: "DateTimeOriginal missing",
      evidence: { timezone: tz, windowStart: starts.toISOString(), windowEndExclusive: endsEx.toISOString() },
    };
  }

  if (Number.isNaN(capture.getTime())) {
    return {
      decision: "DATE_INVALID_REVIEW",
      reasonCode: "CAPTURE_DATE_INVALID",
      publicMessage: "La fecha de captura del archivo es inválida o inconsistente. Quedará en revisión.",
      internalMessage: "invalid capture date",
      evidence: { timezone: tz },
    };
  }

  const t = capture.getTime();
  const inclusiveEnd = endsEx.getTime() - 1; // exclusive end → last inclusive ms
  if (t >= starts.getTime() && t <= inclusiveEnd) {
    return {
      decision: "WITHIN_CAPTURE_WINDOW",
      reasonCode: "CAPTURE_WITHIN_WINDOW",
      publicMessage: "La fecha de captura está dentro del período oficial.",
      internalMessage: "within window",
      evidence: {
        timezone: tz,
        captureAt: capture.toISOString(),
        windowStart: starts.toISOString(),
        windowEndExclusive: endsEx.toISOString(),
      },
    };
  }

  return {
    decision: "OUTSIDE_CAPTURE_WINDOW_REVIEW",
    reasonCode: "CAPTURE_OUTSIDE_WINDOW",
    publicMessage:
      "La fecha de captura parece estar fuera del período oficial. La obra quedará en revisión administrativa.",
    internalMessage: t < starts.getTime() ? "before window" : "after window",
    evidence: {
      timezone: tz,
      captureAt: capture.toISOString(),
      windowStart: starts.toISOString(),
      windowEndExclusive: endsEx.toISOString(),
    },
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
