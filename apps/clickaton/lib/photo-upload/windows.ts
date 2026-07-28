import type { EditionClock } from "@/lib/timeline/clock";
import { systemClock } from "@/lib/timeline/clock";

export type PromptWindowSource = {
  status: string;
  releasedAt: Date | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadStartsAt: Date | null;
  uploadEndsAt: Date | null;
};

/**
 * Política Etapa 11:
 * - Captura efectiva inicia en releasedAt (liberación real) si existe; si no, captureStartsAt planificado.
 * - Subida puede extenderse después del cierre de captura (uploadEndsAt).
 * - No mezclar captura y subida.
 */
export function resolveEffectiveWindows(prompt: PromptWindowSource) {
  const captureStartsAt = prompt.releasedAt ?? prompt.captureStartsAt;
  const captureEndsAt = prompt.captureEndsAt;
  const uploadStartsAt = prompt.uploadStartsAt ?? captureStartsAt;
  const uploadEndsAt = prompt.uploadEndsAt;
  return {
    captureStartsAt,
    captureEndsAt,
    uploadStartsAt,
    uploadEndsAt,
    plannedCaptureStartsAt: prompt.captureStartsAt,
    actualReleasedAt: prompt.releasedAt,
  };
}

export function isPromptReleasedForUpload(status: string): boolean {
  return status === "RELEASED" || status === "CLOSED";
}

export function isWithinUploadWindow(
  windows: ReturnType<typeof resolveEffectiveWindows>,
  clock: EditionClock = systemClock(),
): boolean {
  const now = clock.now().getTime();
  if (!windows.uploadStartsAt) return false;
  if (windows.uploadStartsAt.getTime() > now) return false;
  if (windows.uploadEndsAt && windows.uploadEndsAt.getTime() < now) return false;
  return true;
}

export function evaluateCaptureDate(input: {
  captureDate: Date | null;
  windows: ReturnType<typeof resolveEffectiveWindows>;
  toleranceMinutes: number;
  timezone: string;
}): {
  result: "PASS" | "WARNING" | "FAIL" | "MANUAL_REVIEW";
  deltaMinutes: number | null;
  assumedTimezone: string;
  reason: string;
} {
  const assumedTimezone = input.timezone;
  if (!input.captureDate) {
    return {
      result: "MANUAL_REVIEW",
      deltaMinutes: null,
      assumedTimezone,
      reason: "EXIF_CAPTURE_DATE_ABSENT",
    };
  }
  if (!input.windows.captureStartsAt) {
    return {
      result: "MANUAL_REVIEW",
      deltaMinutes: null,
      assumedTimezone,
      reason: "CAPTURE_WINDOW_NOT_CONFIGURED",
    };
  }

  const t = input.captureDate.getTime();
  const start = input.windows.captureStartsAt.getTime();
  const end = input.windows.captureEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const tol = Math.max(0, input.toleranceMinutes) * 60_000;

  if (t >= start - tol && t <= end + tol) {
    const outsideExact = t < start || t > end;
    return {
      result: outsideExact ? "WARNING" : "PASS",
      deltaMinutes: Math.round((t - start) / 60_000),
      assumedTimezone,
      reason: outsideExact ? "WITHIN_TOLERANCE" : "WITHIN_CAPTURE_WINDOW",
    };
  }

  const extreme = t < start - tol * 6 || t > end + tol * 6;
  return {
    result: extreme ? "FAIL" : "MANUAL_REVIEW",
    deltaMinutes: Math.round((t - start) / 60_000),
    assumedTimezone,
    reason: extreme ? "CAPTURE_OUTSIDE_WINDOW_EXTREME" : "CAPTURE_OUTSIDE_WINDOW",
  };
}

export function evaluateGps(input: {
  mode: "OPTIONAL" | "REQUIRED" | "NOT_REQUIRED" | "GEOFENCE";
  latitude: number | null;
  longitude: number | null;
}): { status: string; result: "PASS" | "WARNING" | "FAIL" | "MANUAL_REVIEW" } {
  const present = input.latitude != null && input.longitude != null;
  if (input.mode === "NOT_REQUIRED") {
    return { status: present ? "PRESENT_VALID" : "ABSENT_ALLOWED", result: "PASS" };
  }
  if (input.mode === "OPTIONAL") {
    return { status: present ? "PRESENT_VALID" : "ABSENT_ALLOWED", result: "PASS" };
  }
  if (input.mode === "REQUIRED") {
    if (!present) return { status: "ABSENT_REQUIRED", result: "FAIL" };
    return { status: "PRESENT_VALID", result: "PASS" };
  }
  // GEOFENCE sin zona configurada → revisión
  if (!present) return { status: "ABSENT_REQUIRED", result: "MANUAL_REVIEW" };
  return { status: "MANUAL_REVIEW", result: "MANUAL_REVIEW" };
}
