import type { EditionClock } from "@/lib/timeline/clock";
import { systemClock } from "@/lib/timeline/clock";
import {
  resolveEditionSchedule,
  scheduleToWindowSource,
  type EditionScheduleSource,
  type PromptScheduleFallback,
} from "./edition-schedule";

export type PromptWindowSource = {
  status: string;
  releasedAt: Date | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadStartsAt: Date | null;
  uploadEndsAt: Date | null;
};

/**
 * ETAPA 12:
 * - Preferir ventanas de EDICIÓN (capture/upload independientes).
 * - NO usar releasedAt como inicio de captura cuando hay captureWindow de edición.
 * - Boundaries [startsAt, endsAt) — fin exclusivo.
 * - La hora de upload NUNCA valida la captura.
 */
export function resolveEffectiveWindows(
  prompt: PromptWindowSource,
  edition?: EditionScheduleSource | null,
) {
  const schedule = resolveEditionSchedule(edition ?? null, prompt as PromptScheduleFallback);
  if (schedule.hasEditionCaptureWindow || schedule.hasEditionUploadWindow) {
    const src = scheduleToWindowSource(schedule);
    return {
      captureStartsAt: src.captureStartsAt,
      captureEndsAt: src.captureEndsAt,
      uploadStartsAt: src.uploadStartsAt,
      uploadEndsAt: src.uploadEndsAt,
      plannedCaptureStartsAt: schedule.captureStartsAt,
      actualReleasedAt: edition?.eventRevealAt ?? prompt.releasedAt,
      schedule,
    };
  }

  // Legacy (fixtures staggered / ediciones sin SoT edición):
  // captura efectiva puede usar releasedAt solo si no hay ventanas de edición.
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
    schedule,
  };
}

export function isPromptReleasedForUpload(
  status: string,
  options?: {
    edition?: EditionScheduleSource | null;
    clock?: EditionClock;
  },
): boolean {
  const edition = options?.edition;
  const clock = options?.clock ?? systemClock();
  if (edition?.globalPromptReveal !== false && edition?.eventRevealAt) {
    return edition.eventRevealAt.getTime() <= clock.now().getTime() && status !== "DRAFT" && status !== "CANCELLED";
  }
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
 */
export function isWithinUploadWindow(
  windows: ReturnType<typeof resolveEffectiveWindows>,
  clock: EditionClock = systemClock(),
): boolean {
  return getUploadWindowState(windows, clock) === "OPEN";
}

/**
 * Capture window exacta: [startsAt, endsAt) — exclusive end.
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
 * Captura cerrada, upload aún abierto.
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
  if (!present) return { status: "ABSENT_REQUIRED", result: "MANUAL_REVIEW" };
  return { status: "MANUAL_REVIEW", result: "MANUAL_REVIEW" };
}
