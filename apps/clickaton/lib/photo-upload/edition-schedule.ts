/**
 * ETAPA 12 — Fuente de verdad temporal de maratón a nivel edición.
 *
 * - Reveal GLOBAL de consignas (todas juntas).
 * - Ventana de CAPTURA independiente (cuándo debió tomarse la foto).
 * - Ventana de CARGA independiente (cuándo el servidor acepta el archivo).
 *
 * No mezclar captura y carga. No usar releasedAt individual como start de captura
 * cuando la edición tiene ventanas canónicas configuradas.
 */
import type { EditionClock } from "@/lib/timeline/clock";
import { systemClock } from "@/lib/timeline/clock";

export type EditionScheduleSource = {
  globalPromptReveal?: boolean | null;
  eventRevealAt?: Date | null;
  captureWindowStartsAt?: Date | null;
  captureWindowEndsAt?: Date | null;
  uploadWindowStartsAt?: Date | null;
  uploadWindowEndsAt?: Date | null;
  allowReplacement?: boolean | null;
  captureClockToleranceMinutes?: number | null;
};

export type PromptScheduleFallback = {
  status: string;
  releasedAt: Date | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadStartsAt: Date | null;
  uploadEndsAt: Date | null;
  allowReplacement?: boolean | null;
};

export type ResolvedEditionSchedule = {
  /** true = todas las consignas se revelan juntas. */
  globalPromptReveal: boolean;
  eventRevealAt: Date | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadStartsAt: Date | null;
  uploadEndsAt: Date | null;
  allowReplacement: boolean;
  captureClockToleranceMinutes: number;
  /** Edition SoT windows are present (not prompt-only fallback). */
  hasEditionCaptureWindow: boolean;
  hasEditionUploadWindow: boolean;
  source: "edition" | "prompt_fallback" | "mixed";
};

export function resolveEditionSchedule(
  edition: EditionScheduleSource | null | undefined,
  promptFallback?: PromptScheduleFallback | null,
): ResolvedEditionSchedule {
  const globalPromptReveal = edition?.globalPromptReveal !== false;
  const eventRevealAt = edition?.eventRevealAt ?? null;

  const editionCaptureStart = edition?.captureWindowStartsAt ?? null;
  const editionCaptureEnd = edition?.captureWindowEndsAt ?? null;
  const editionUploadStart = edition?.uploadWindowStartsAt ?? null;
  const editionUploadEnd = edition?.uploadWindowEndsAt ?? null;

  const hasEditionCaptureWindow = Boolean(editionCaptureStart);
  const hasEditionUploadWindow = Boolean(editionUploadStart);

  // CRITICAL: when edition capture window exists, do NOT use releasedAt as capture start.
  const captureStartsAt =
    editionCaptureStart ??
    (promptFallback
      ? // Legacy staggered: only if edition windows missing.
        promptFallback.captureStartsAt
      : null);
  const captureEndsAt = editionCaptureEnd ?? promptFallback?.captureEndsAt ?? null;

  const uploadStartsAt =
    editionUploadStart ?? promptFallback?.uploadStartsAt ?? captureStartsAt;
  const uploadEndsAt = editionUploadEnd ?? promptFallback?.uploadEndsAt ?? null;

  let source: ResolvedEditionSchedule["source"] = "prompt_fallback";
  if (hasEditionCaptureWindow && hasEditionUploadWindow) source = "edition";
  else if (hasEditionCaptureWindow || hasEditionUploadWindow) source = "mixed";

  return {
    globalPromptReveal,
    eventRevealAt,
    captureStartsAt,
    captureEndsAt,
    uploadStartsAt,
    uploadEndsAt,
    allowReplacement: edition?.allowReplacement ?? promptFallback?.allowReplacement ?? true,
    captureClockToleranceMinutes: edition?.captureClockToleranceMinutes ?? 5,
    hasEditionCaptureWindow,
    hasEditionUploadWindow,
    source,
  };
}

/** ¿Ya se revelaron las consignas (modo global)? */
export function arePromptsGloballyRevealed(
  schedule: ResolvedEditionSchedule,
  clock: EditionClock = systemClock(),
): boolean {
  if (!schedule.globalPromptReveal) {
    // Legacy: caller must evaluate per-prompt.
    return false;
  }
  if (!schedule.eventRevealAt) return false;
  return schedule.eventRevealAt.getTime() <= clock.now().getTime();
}

export type CapturePhase = "NOT_OPEN" | "OPEN" | "CLOSED" | "NOT_CONFIGURED";
export type UploadPhase = "NOT_OPEN" | "OPEN" | "CLOSED" | "NOT_CONFIGURED";

export function getCapturePhase(
  schedule: ResolvedEditionSchedule,
  clock: EditionClock = systemClock(),
): CapturePhase {
  if (!schedule.captureStartsAt) return "NOT_CONFIGURED";
  const now = clock.now().getTime();
  if (schedule.captureStartsAt.getTime() > now) return "NOT_OPEN";
  if (schedule.captureEndsAt && schedule.captureEndsAt.getTime() <= now) return "CLOSED";
  return "OPEN";
}

export function getUploadPhase(
  schedule: ResolvedEditionSchedule,
  clock: EditionClock = systemClock(),
): UploadPhase {
  if (!schedule.uploadStartsAt) return "NOT_CONFIGURED";
  const now = clock.now().getTime();
  if (schedule.uploadStartsAt.getTime() > now) return "NOT_OPEN";
  if (schedule.uploadEndsAt && schedule.uploadEndsAt.getTime() <= now) return "CLOSED";
  return "OPEN";
}

export function isCaptureClosedUploadOpenSchedule(
  schedule: ResolvedEditionSchedule,
  clock: EditionClock = systemClock(),
): boolean {
  return getUploadPhase(schedule, clock) === "OPEN" && getCapturePhase(schedule, clock) === "CLOSED";
}

/** Convert edition schedule to the shape expected by windows.ts helpers. */
export function scheduleToWindowSource(schedule: ResolvedEditionSchedule): {
  status: string;
  releasedAt: Date | null;
  captureStartsAt: Date | null;
  captureEndsAt: Date | null;
  uploadStartsAt: Date | null;
  uploadEndsAt: Date | null;
} {
  return {
    status: "RELEASED",
    // Intentionally null: capture must not pivot on releasedAt when using edition SoT.
    releasedAt: null,
    captureStartsAt: schedule.captureStartsAt,
    captureEndsAt: schedule.captureEndsAt,
    uploadStartsAt: schedule.uploadStartsAt,
    uploadEndsAt: schedule.uploadEndsAt,
  };
}

export function formatScheduleRange(
  start: Date | null,
  end: Date | null,
  timezone: string,
): string {
  const fmt = (d: Date) =>
    d.toLocaleString("es-AR", {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  if (!start && !end) return "a confirmar";
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `desde ${fmt(start)}`;
  return `hasta ${fmt(end!)}`;
}
