import type { EditionClock } from "./clock";
import { systemClock } from "./clock";
import type { PromptPublicDto, PromptRecord } from "./types";

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

/**
 * Construye DTO público distinto según estado temporal.
 * Nunca reutiliza el mismo shape omitiendo campos visualmente.
 */
export function toPromptPublicDto(
  prompt: PromptRecord,
  options?: { clock?: EditionClock; showOpensAt?: boolean },
): PromptPublicDto {
  const clock = options?.clock ?? systemClock();
  const serverNow = clock.now().toISOString();
  const now = clock.now().getTime();

  if (prompt.status === "CANCELLED") {
    return {
      sequence: prompt.sequence,
      status: "CLOSED",
      title: null,
      serverNow,
      message: "Consigna cancelada.",
    };
  }

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

  // DRAFT never reveals. LOCKED/READY stay opaque until schedule or manual release.
  const isOpen = manuallyReleased || (prompt.status !== "DRAFT" && scheduleOpen);

  if (!isOpen || prompt.status === "DRAFT") {
    return {
      sequence: prompt.sequence,
      status: "LOCKED",
      opensAt: options?.showOpensAt === false ? null : iso(opensAt),
      serverNow,
      message: "Consigna todavía no disponible.",
    };
  }

  const closedByTime =
    (prompt.captureEndsAt != null && prompt.captureEndsAt.getTime() < now) ||
    (prompt.uploadEndsAt != null && prompt.uploadEndsAt.getTime() < now);

  if (closedByTime) {
    return {
      sequence: prompt.sequence,
      status: "CLOSED",
      title: prompt.title,
      serverNow,
      message: "La ventana de esta consigna finalizó.",
    };
  }

  return {
    sequence: prompt.sequence,
    status: "RELEASED",
    title: prompt.title ?? "",
    instructions: prompt.instructions ?? "",
    shortDescription: prompt.shortDescription,
    captureEndsAt: iso(prompt.captureEndsAt),
    uploadEndsAt: iso(prompt.uploadEndsAt),
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
