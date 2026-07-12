/**
 * Estado temporal del evento (independiente del estado editorial).
 */

export const EVENT_TEMPORAL_STATES = [
  "UPCOMING",
  "TODAY",
  "IN_PROGRESS",
  "FINISHED",
  "CANCELLED",
  "UNKNOWN",
] as const;

export type EventTemporalState = (typeof EVENT_TEMPORAL_STATES)[number];

function startOfDay(d: Date): Date {
  // Aproximación UTC-3 fija suficiente para clasificación diaria (America/Argentina/Buenos_Aires).
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(d.getTime() - offsetMs);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const day = local.getUTCDate();
  return new Date(Date.UTC(y, m, day) + offsetMs);
}

export function getEventTemporalState(input: {
  startAt: Date | string | null | undefined;
  endAt?: Date | string | null;
  now?: Date;
}): EventTemporalState {
  if (!input.startAt) return "UNKNOWN";
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) return "UNKNOWN";
  const now = input.now ?? new Date();
  const end = input.endAt ? new Date(input.endAt) : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;

  if (endValid && endValid.getTime() < now.getTime()) return "FINISHED";
  if (!endValid && start.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
    return "FINISHED";
  }

  const today0 = startOfDay(now);
  const tomorrow0 = new Date(today0.getTime() + 24 * 60 * 60 * 1000);
  if (start >= today0 && start < tomorrow0) {
    if (start <= now && (!endValid || endValid >= now)) return "IN_PROGRESS";
    if (start > now) return "TODAY";
    return "TODAY";
  }

  if (start > now) return "UPCOMING";
  if (endValid && start <= now && endValid >= now) return "IN_PROGRESS";
  return "FINISHED";
}

export function temporalStateLabel(state: EventTemporalState): string {
  switch (state) {
    case "UPCOMING":
      return "Próximamente";
    case "TODAY":
      return "Hoy";
    case "IN_PROGRESS":
      return "En curso";
    case "FINISHED":
      return "Finalizado";
    case "CANCELLED":
      return "Cancelado";
    default:
      return "";
  }
}
