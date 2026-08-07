import type { BenefitRecord, ParticipationRecord } from "./types";

/** Días por defecto para “próximo a vencer”. */
export const BENEFIT_EXPIRING_SOON_DAYS = 7;

export function isBenefitCurrentlyAvailable(input: {
  benefit: Pick<
    BenefitRecord,
    "status" | "archivedAt" | "startsAt" | "endsAt"
  >;
  participation?: Pick<ParticipationRecord, "status" | "archivedAt"> | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (input.benefit.status !== "ACTIVE") return false;
  if (input.benefit.archivedAt) return false;
  if (input.benefit.startsAt && input.benefit.startsAt.getTime() > now.getTime()) {
    return false;
  }
  if (input.benefit.endsAt && input.benefit.endsAt.getTime() < now.getTime()) {
    return false;
  }
  if (input.participation) {
    if (input.participation.archivedAt) return false;
    if (
      input.participation.status === "ARCHIVED" ||
      input.participation.status === "CANCELLED"
    ) {
      return false;
    }
  }
  return true;
}

export function isBenefitExpiringSoon(input: {
  endsAt: Date | null | undefined;
  now?: Date;
  withinDays?: number;
}): boolean {
  if (!input.endsAt) return false;
  const now = input.now ?? new Date();
  const days = input.withinDays ?? BENEFIT_EXPIRING_SOON_DAYS;
  const ms = days * 24 * 60 * 60 * 1000;
  const end = input.endsAt.getTime();
  return end >= now.getTime() && end <= now.getTime() + ms;
}

/** Extrae primera URL http(s) absoluta de un texto (p. ej. instrucciones). */
export function extractSafeHttpUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  if (!match) return null;
  try {
    const parsed = new URL(match[0]!);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
