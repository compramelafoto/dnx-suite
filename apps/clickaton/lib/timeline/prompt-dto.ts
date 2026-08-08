import type { EditionClock } from "./clock";
import { systemClock } from "./clock";
import type { EditionScheduleRecord, PromptPublicDto, PromptRecord } from "./types";
import {
  arePromptsGloballyRevealed,
  resolveEditionSchedule,
} from "@/lib/photo-upload/edition-schedule";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * DTO público. ETAPA 12: con globalPromptReveal, todas las consignas
 * se revelan juntas en eventRevealAt (nunca staggered).
 */
export function toPromptPublicDto(
  prompt: PromptRecord,
  options?: {
    clock?: EditionClock;
    showOpensAt?: boolean;
    editionSchedule?: EditionScheduleRecord | null;
  },
): PromptPublicDto {
  const clock = options?.clock ?? systemClock();
  const serverNow = clock.now().toISOString();
  const now = clock.now().getTime();
  const schedule = resolveEditionSchedule(options?.editionSchedule ?? null, {
    status: prompt.status,
    releasedAt: prompt.releasedAt,
    captureStartsAt: prompt.captureStartsAt,
    captureEndsAt: prompt.captureEndsAt,
    uploadStartsAt: prompt.uploadStartsAt ?? null,
    uploadEndsAt: prompt.uploadEndsAt,
  });

  if (prompt.status === "CANCELLED") {
    return {
      sequence: prompt.sequence,
      status: "CLOSED",
      title: null,
      serverNow,
      message: "Consigna cancelada.",
    };
  }

  const globalMode = schedule.globalPromptReveal && Boolean(schedule.eventRevealAt);
  const globallyRevealed = globalMode && arePromptsGloballyRevealed(schedule, clock);

  // Antes del reveal global: LOCKED sin secretos (mismo opensAt para todas).
  if (globalMode && !globallyRevealed) {
    return {
      sequence: prompt.sequence,
      status: "LOCKED",
      opensAt: options?.showOpensAt === false ? null : iso(schedule.eventRevealAt),
      serverNow,
      message: "Las consignas se revelarán todas juntas en el horario del evento.",
    };
  }

  if (prompt.status === "DRAFT" && !globallyRevealed) {
    return {
      sequence: prompt.sequence,
      status: "LOCKED",
      opensAt: options?.showOpensAt === false ? null : iso(schedule.eventRevealAt ?? prompt.captureStartsAt),
      serverNow,
      message: "Consigna todavía no disponible.",
    };
  }

  // Legacy per-prompt reveal (solo si NO hay modo global).
  if (!globalMode) {
    if (prompt.status === "CLOSED") {
      return {
        sequence: prompt.sequence,
        status: "CLOSED",
        title: prompt.title,
        serverNow,
        message: "Ventana de consigna cerrada.",
      };
    }
    const opensAt = prompt.releasedAt ?? prompt.captureStartsAt;
    const manuallyReleased = prompt.status === "RELEASED" || prompt.releasedAt != null;
    const scheduleOpen =
      opensAt != null &&
      opensAt.getTime() <= now &&
      (prompt.status === "READY" || prompt.status === "LOCKED" || prompt.status === "RELEASED");
    const isOpen = manuallyReleased || (prompt.status !== "DRAFT" && scheduleOpen);
    if (!isOpen) {
      return {
        sequence: prompt.sequence,
        status: "LOCKED",
        opensAt: options?.showOpensAt === false ? null : iso(opensAt),
        serverNow,
        message: "Consigna todavía no disponible.",
      };
    }
  }

  const uploadClosed =
    schedule.uploadEndsAt != null && schedule.uploadEndsAt.getTime() <= now;

  if (uploadClosed || prompt.status === "CLOSED") {
    return {
      sequence: prompt.sequence,
      status: "CLOSED",
      title: prompt.title,
      serverNow,
      message: "Finalizó el período de entrega de fotografías.",
    };
  }

  return {
    sequence: prompt.sequence,
    status: "RELEASED",
    title: prompt.title ?? "",
    instructions: prompt.instructions ?? "",
    shortDescription: prompt.shortDescription,
    captureEndsAt: iso(schedule.captureEndsAt ?? prompt.captureEndsAt),
    uploadEndsAt: iso(schedule.uploadEndsAt ?? prompt.uploadEndsAt),
    assets: [
      prompt.imageAssetId ? { kind: "image", assetId: prompt.imageAssetId } : null,
      prompt.videoAssetId ? { kind: "video", assetId: prompt.videoAssetId } : null,
      prompt.audioAssetId ? { kind: "audio", assetId: prompt.audioAssetId } : null,
    ].filter((a): a is { kind: string; assetId: string } => Boolean(a)),
    serverNow,
  };
}

/** Assert de seguridad para tests: payload LOCKED no debe filtrar secretos. */
export function assertLockedDtoIsSafe(dto: PromptPublicDto): void {
  if (dto.status !== "LOCKED") return;
  const raw = JSON.stringify(dto);
  if (/"title"\s*:/.test(raw) || /"instructions"\s*:/.test(raw) || /"assets"\s*:/.test(raw)) {
    throw new Error("LOCKED_DTO_LEAK");
  }
}
