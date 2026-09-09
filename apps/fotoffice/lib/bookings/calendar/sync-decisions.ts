import type { Interval } from "../time";

/**
 * Qué hacer con cada evento que llega de Google. Módulo PURO: sin base y sin red.
 *
 * Es la pieza que decide, y por eso vive separada del cliente HTTP: se puede probar el
 * caso difícil —un evento propio que vuelve— sin hablar con Google.
 */

/**
 * La marca que FOTOFFICE pone en los eventos que crea.
 *
 * **Sin esto la sincronización se muerde la cola**: crea el evento de una reserva, lo lee
 * de vuelta, lo toma como un bloqueo cargado a mano y termina tapando su propia reserva.
 */
export const FOTOFFICE_EVENT_PROPERTY = "fotofficeBookingId";

export type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

export type SyncDecision =
  /** Es nuestro, o no se puede interpretar. No toca nada. */
  | { kind: "IGNORE"; motivo: string }
  /** Cargado a mano en el calendario: ocupa el espacio. */
  | { kind: "BLOCK"; eventId: string; range: Interval; summary: string | null; allDay: boolean }
  /** Se borró en Google: su bloqueo deja de existir. */
  | { kind: "DELETE"; eventId: string };

/** El rango que ocupa un evento, o null si no se puede interpretar. */
export function toBlockInterval(event: GoogleEvent): Interval | null {
  const desde = event.start?.dateTime ?? event.start?.date;
  const hasta = event.end?.dateTime ?? event.end?.date;
  if (!desde || !hasta) return null;

  const startAt = new Date(desde);
  const endAt = new Date(hasta);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  if (endAt.getTime() <= startAt.getTime()) return null;

  return { startAt, endAt };
}

export function decideForEvent(event: GoogleEvent): SyncDecision {
  if (!event.id) return { kind: "IGNORE", motivo: "el evento no trae identificador" };

  // Un evento borrado o cancelado en Google deja de ocupar, sea de quien sea.
  if (event.status === "cancelled") return { kind: "DELETE", eventId: event.id };

  const propio = event.extendedProperties?.private?.[FOTOFFICE_EVENT_PROPERTY];
  if (propio) return { kind: "IGNORE", motivo: "lo creó FotoOffice" };

  const range = toBlockInterval(event);
  if (!range) return { kind: "IGNORE", motivo: "no tiene un horario interpretable" };

  return {
    kind: "BLOCK",
    eventId: event.id,
    range,
    summary: event.summary ?? null,
    allDay: Boolean(event.start?.date && !event.start?.dateTime),
  };
}

/**
 * ¿El `syncToken` dejó de valer?
 *
 * Google contesta 410 cuando el token es viejo: hay que borrarlo y recargar la ventana
 * entera. Se reconoce **solo** ese caso: recargar todo por un error de red cuesta muchas
 * llamadas y no arregla nada.
 */
export function isSyncTokenExpired(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; status?: unknown; message?: unknown };
  if (e.code === 410 || e.status === 410) return true;
  return typeof e.message === "string" && e.message.toLowerCase().includes("sync token");
}
