import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { GOVERNANCE_TIME_ZONE, type ProjectStatus } from "./constants";
import { canTransition } from "./lifecycle";

/**
 * Reuniones de comisión: temario, tratamiento y acta (diseño §9). Módulo PURO.
 *
 * PLANNED → HELD → MINUTES_APPROVED. Mientras no se aprueba el acta se puede tratar, reordenar y
 * corregir; aprobada, queda fija y lo posterior son notas agregadas.
 */

export const MEETING_STATUSES = ["PLANNED", "HELD", "MINUTES_APPROVED"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const ITEM_OUTCOMES = ["APPROVED", "REJECTED", "POSTPONED", "CONTINUES"] as const;
export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

export function isItemOutcome(v: string): v is ItemOutcome {
  return (ITEM_OUTCOMES as readonly string[]).includes(v);
}

export function meetingStatusLabel(s: string): string {
  return s === "PLANNED" ? "Convocada" : s === "HELD" ? "Realizada" : s === "MINUTES_APPROVED" ? "Acta aprobada" : s;
}

export function outcomeLabel(o: string): string {
  switch (o) {
    case "APPROVED":
      return "Aprobado";
    case "REJECTED":
      return "Rechazado";
    case "POSTPONED":
      return "Postergado";
    case "CONTINUES":
      return "Sigue en tratamiento";
    default:
      return o;
  }
}

/** Mientras el acta no está aprobada, el temario y lo decidido se pueden tocar. */
export function isMinutesLocked(status: string): boolean {
  return status === "MINUTES_APPROVED";
}

/** Proyectos que entran solos al temario: los que esperan una decisión. */
export const AGENDA_STATUSES: readonly ProjectStatus[] = ["PROPOSED", "IN_REVIEW", "POSTPONED"];

/**
 * A qué estado pasa el proyecto según lo que se resolvió. `null`: no cambia.
 *
 * "Sigue en tratamiento" mueve un Propuesto a En tratamiento (ya se habló) y deja como está a
 * uno que ya estaba en tratamiento o postergado.
 */
export function targetStatusFor(outcome: ItemOutcome, current: ProjectStatus): ProjectStatus | null {
  if (outcome === "CONTINUES") return current === "PROPOSED" ? "IN_REVIEW" : null;
  return outcome === current ? null : outcome;
}

/** Si el resultado se puede aplicar al proyecto desde su estado actual. */
export function canApplyOutcome(outcome: ItemOutcome, current: ProjectStatus): boolean {
  const destino = targetStatusFor(outcome, current);
  if (destino === null) return outcome === "CONTINUES" ? AGENDA_STATUSES.includes(current) : true;
  return canTransition(current, destino);
}

type Resultado<T> = { ok: true; values: T } | { ok: false; error: string };

export type MeetingFormValues = { title: string; scheduledAt: Date; location: string | null };

export function parseMeetingForm(fd: FormData): Resultado<MeetingFormValues> {
  const title = String(fd.get("title") ?? "").trim() || "Reunión de comisión";
  if (title.length > 160) return { ok: false, error: "El título es demasiado largo." };
  const cruda = String(fd.get("scheduledAt") ?? "").trim();
  if (!cruda) return { ok: false, error: "Poné la fecha y la hora de la reunión." };
  const scheduledAt = parseLocalDateTime(cruda, GOVERNANCE_TIME_ZONE);
  if (!scheduledAt) return { ok: false, error: "La fecha de la reunión no se entiende." };
  const location = String(fd.get("location") ?? "").trim() || null;
  if (location && location.length > 500) return { ok: false, error: "El lugar es demasiado largo." };
  return { ok: true, values: { title, scheduledAt, location } };
}

/** Intercambia un elemento con su vecino. Devuelve el nuevo orden o `null` si no se puede mover. */
export function moveInOrder<T>(ids: readonly T[], id: T, direction: "up" | "down"): T[] | null {
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return null;
  const out = ids.slice();
  [out[i], out[j]] = [out[j]!, out[i]!];
  return out;
}
