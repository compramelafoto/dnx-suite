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
 * Política Etapa 11 / 10G.3:
 * - Captura efectiva inicia en releasedAt (liberación real) si existe; si no, captureStartsAt planificado.
 * - captureEndsAt / uploadEndsAt son boundaries EXCLUSIVOS (t < endsAt).
 * - Subida puede extenderse después del cierre de captura (uploadEndsAt > captureEndsAt).
 * - No mezclar captura y subida: la hora de upload no valida la captura.
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

export type UploadWindowState = "NOT_OPEN" | "OPEN" | "CLOSED" | "NOT_CONFIGURED";

export function getUploadWindowState(
  windows: ReturnType<typeof resolveEffectiveWindows>,
  clock: EditionClock = systemClock(),
): UploadWindowState {
  if (!windows.uploadStartsAt) return "NOT_CONFIGURED";
  const now = clock.now().getTime();
  if (windows.uploadStartsAt.getTime() > now) return "NOT_OPEN";
  if (windows.uploadEndsAt && windows.uploadEndsAt.getTime() <= now) return "CLOSED";
  return "OPEN";
}

/**
 * Upload window: [startsAt, endsAt) — exclusive end.
 * AR2026: a las 22:00:00.000 server-side se rechaza cualquier nuevo upload.
 */
export function isWithinUploadWindow(
  windows: ReturnType<typeof resolveEffectiveWindows>,
  clock: EditionClock = systemClock(),
): boolean {
  return getUploadWindowState(windows, clock) === "OPEN";
}

/**
 * Capture window exacta: [startsAt, endsAt) — exclusive end.
 * AR2026: 16:00:00 inclusive … 20:00:00 exclusive.
 * No inventa timestamps si EXIF ausente.
 */
export function isWithinCaptureWindowExact(input: {
  captureDate: Date | null;
  windows: ReturnType<typeof resolveEffectiveWindows>;
}): boolean {
  if (!input.captureDate || !input.windows.captureStartsAt) return false;
  const t = input.captureDate.getTime();
  const start = input.windows.captureStartsAt.getTime();
  const end = input.windows.captureEndsAt?.getTime();
  if (t < start) return false;
  if (end != null && t >= end) return false;
  return true;
}

/**
 * Fase 20:00–22:00: captura cerrada, upload aún abierto.
 */
export function isCaptureClosedUploadOpen(
  windows: ReturnType<typeof resolveEffectiveWindows>,
  clock: EditionClock = systemClock(),
): boolean {
  if (!isWithinUploadWindow(windows, clock)) return false;
  if (!windows.captureEndsAt) return false;
  return clock.now().getTime() >= windows.captureEndsAt.getTime();
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
  /** Exclusive end boundary. */
  const end = input.windows.captureEndsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const tol = Math.max(0, input.toleranceMinutes) * 60_000;

  const withinExact = t >= start && t < end;
  const withinSoft = t >= start - tol && t < end + tol;

  if (withinSoft) {
    return {
      result: withinExact ? "PASS" : "WARNING",
      deltaMinutes: Math.round((t - start) / 60_000),
      assumedTimezone,
      reason: withinExact ? "WITHIN_CAPTURE_WINDOW" : "WITHIN_TOLERANCE",
    };
  }

  const extreme = t < start - tol * 6 || t >= end + tol * 6;
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
