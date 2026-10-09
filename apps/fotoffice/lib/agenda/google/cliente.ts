import "server-only";
import { CalendarHttpError } from "@/lib/bookings/calendar/client";
import type { CuerpoEventoGoogle, EventoGoogle } from "../sync-decisiones";
import { HUSO_HORARIO } from "../constantes";

/**
 * Cliente de Google Calendar de la Agenda: lo único de la Agenda que habla por la red.
 *
 * Es aparte del cliente de Reservas (`lib/bookings/calendar/client.ts`) para no tocar su comportamiento:
 * acá cualquier calendario y cualquier evento (insert con id, patch, delete, list con `syncToken`).
 * Vive detrás de un tipo para probar la sincronización con un doble: ningún test sale a la red.
 * El cuerpo de las respuestas de error no se propaga (puede traer datos de la cuenta): sólo el código.
 */

const API = "https://www.googleapis.com/calendar/v3";

export type EventoEscrito = { id: string; etag: string | null; updated: string | null };

export type PaginaDeEventos = {
  events: EventoGoogle[];
  /** Sólo viene en la última página. */
  nextSyncToken: string | null;
  nextPageToken: string | null;
};

export type ClienteAgenda = {
  crearCalendario(resumen: string): Promise<string>;
  /** Borra un calendario secundario (sólo para deshacer uno recién creado que perdió una carrera). 404/410 es éxito. */
  borrarCalendario(calendarId: string): Promise<void>;
  /** `eventId` opcional: un id ya usado (aun por un evento borrado) da 409. */
  insertarEvento(calendarId: string, cuerpo: CuerpoEventoGoogle, eventId?: string): Promise<EventoEscrito>;
  parchearEvento(calendarId: string, eventId: string, cuerpo: CuerpoEventoGoogle): Promise<EventoEscrito>;
  /** Borrar algo ya borrado o inexistente (404/410) es éxito. */
  borrarEvento(calendarId: string, eventId: string): Promise<void>;
  listarEventos(entrada: {
    calendarId: string;
    syncToken?: string | null;
    timeMin?: Date;
    timeMax?: Date;
    pageToken?: string | null;
    /** `clave=valor` sobre las propiedades privadas (p. ej. `foKind=entrega`). */
    propiedadPrivada?: string;
    /** Por omisión true: la traída necesita ver los borrados. */
    conBorrados?: boolean;
  }): Promise<PaginaDeEventos>;
};

export function codigoHttp(error: unknown): number | null {
  return error instanceof CalendarHttpError ? error.code : null;
}

/** 409: el id ya existe (o existió). */
export function esConflicto(error: unknown): boolean {
  return codigoHttp(error) === 409;
}

/** 404/410: el evento ya no está. */
export function esInexistente(error: unknown): boolean {
  const c = codigoHttp(error);
  return c === 404 || c === 410;
}

/** 403: la cuenta no otorgó el permiso (hay que reconectar). */
export function esFaltaDePermiso(error: unknown): boolean {
  return codigoHttp(error) === 403;
}

/** Sólo para los registros: un código corto, nunca el mensaje ni datos. */
export function codigoDeError(error: unknown): string {
  const c = codigoHttp(error);
  return c !== null ? `HTTP_${c}` : "ERROR";
}

export function crearClienteAgenda(accessToken: string): ClienteAgenda {
  async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new CalendarHttpError(res.status, `Google Calendar respondió ${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  const rutaEventos = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}/events`;
  const escrito = (r: { id: string; etag?: string; updated?: string }): EventoEscrito => ({
    id: r.id,
    etag: r.etag ?? null,
    updated: r.updated ?? null,
  });

  return {
    async crearCalendario(resumen) {
      const r = await pedir<{ id: string }>("/calendars", {
        method: "POST",
        body: JSON.stringify({ summary: resumen, timeZone: HUSO_HORARIO }),
      });
      return r.id;
    },

    async borrarCalendario(calendarId) {
      try {
        await pedir<void>(`/calendars/${encodeURIComponent(calendarId)}`, { method: "DELETE" });
      } catch (error) {
        if (esInexistente(error)) return;
        throw error;
      }
    },

    async insertarEvento(calendarId, cuerpo, eventId) {
      const r = await pedir<{ id: string; etag?: string; updated?: string }>(rutaEventos(calendarId), {
        method: "POST",
        body: JSON.stringify(eventId ? { ...cuerpo, id: eventId } : cuerpo),
      });
      return escrito(r);
    },

    async parchearEvento(calendarId, eventId, cuerpo) {
      const r = await pedir<{ id: string; etag?: string; updated?: string }>(`${rutaEventos(calendarId)}/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(cuerpo),
      });
      return escrito(r);
    },

    async borrarEvento(calendarId, eventId) {
      try {
        await pedir<void>(`${rutaEventos(calendarId)}/${encodeURIComponent(eventId)}`, { method: "DELETE" });
      } catch (error) {
        if (esInexistente(error)) return;
        throw error;
      }
    },

    async listarEventos(entrada) {
      const q = new URLSearchParams({ maxResults: "250", showDeleted: entrada.conBorrados === false ? "false" : "true", singleEvents: "true" });
      if (entrada.syncToken) {
        // Con syncToken Google no admite timeMin/timeMax ni filtros: el token ya los recuerda.
        q.set("syncToken", entrada.syncToken);
      } else {
        if (entrada.timeMin) q.set("timeMin", entrada.timeMin.toISOString());
        if (entrada.timeMax) q.set("timeMax", entrada.timeMax.toISOString());
        if (entrada.propiedadPrivada) q.set("privateExtendedProperty", entrada.propiedadPrivada);
      }
      if (entrada.pageToken) q.set("pageToken", entrada.pageToken);
      const r = await pedir<{ items?: EventoGoogle[]; nextSyncToken?: string; nextPageToken?: string }>(`${rutaEventos(entrada.calendarId)}?${q.toString()}`);
      return { events: r.items ?? [], nextSyncToken: r.nextSyncToken ?? null, nextPageToken: r.nextPageToken ?? null };
    },
  };
}
