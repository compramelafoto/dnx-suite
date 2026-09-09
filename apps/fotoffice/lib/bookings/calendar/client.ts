import "server-only";
import { FOTOFFICE_EVENT_PROPERTY, type GoogleEvent } from "./sync-decisions";

/**
 * Cliente de Google Calendar. Lo único de este módulo que habla por la red.
 *
 * Vive detrás de una interfaz para que la sincronización se pueda probar con un doble:
 * ningún test llama a Google.
 */

const API = "https://www.googleapis.com/calendar/v3";

export type CalendarListEntry = { id: string; summary: string; primary: boolean };

export type ChangesPage = {
  events: GoogleEvent[];
  /** Guardar para la próxima corrida. Solo viene en la última página. */
  nextSyncToken: string | null;
  nextPageToken: string | null;
};

export type CalendarClient = {
  listCalendars(): Promise<CalendarListEntry[]>;
  createCalendar(summary: string): Promise<string>;
  createEvent(input: {
    calendarId: string;
    bookingId: string;
    summary: string;
    description: string;
    startAt: Date;
    endAt: Date;
    timeZone: string;
  }): Promise<string>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  listChanges(input: {
    calendarId: string;
    syncToken?: string | null;
    timeMin?: Date;
    timeMax?: Date;
    pageToken?: string | null;
  }): Promise<ChangesPage>;
};

/** Error con el código HTTP a la vista, para que `isSyncTokenExpired` pueda reconocerlo. */
class CalendarHttpError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.name = "CalendarHttpError";
    this.code = code;
  }
}

export function createCalendarClient(accessToken: string): CalendarClient {
  async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      // El cuerpo puede traer el token o datos de la cuenta: no se propaga, solo el código.
      throw new CalendarHttpError(res.status, `Google Calendar respondió ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    async listCalendars() {
      const r = await pedir<{ items?: { id: string; summary?: string; primary?: boolean }[] }>(
        "/users/me/calendarList?minAccessRole=writer&maxResults=250",
      );
      return (r.items ?? []).map((c) => ({
        id: c.id,
        summary: c.summary ?? c.id,
        primary: c.primary === true,
      }));
    },

    async createCalendar(summary) {
      const r = await pedir<{ id: string }>("/calendars", {
        method: "POST",
        body: JSON.stringify({ summary }),
      });
      return r.id;
    },

    async createEvent(input) {
      const r = await pedir<{ id: string }>(
        `/calendars/${encodeURIComponent(input.calendarId)}/events`,
        {
          method: "POST",
          body: JSON.stringify({
            summary: input.summary,
            description: input.description,
            start: { dateTime: input.startAt.toISOString(), timeZone: input.timeZone },
            end: { dateTime: input.endAt.toISOString(), timeZone: input.timeZone },
            // La marca que impide que la sincronización se muerda la cola.
            extendedProperties: { private: { [FOTOFFICE_EVENT_PROPERTY]: input.bookingId } },
          }),
        },
      );
      return r.id;
    },

    async deleteEvent(calendarId, eventId) {
      try {
        await pedir<void>(
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        // Ya no está: borrar algo borrado es el resultado que queríamos.
        if (error instanceof CalendarHttpError && (error.code === 404 || error.code === 410)) return;
        throw error;
      }
    },

    async listChanges(input) {
      const q = new URLSearchParams({ maxResults: "250", showDeleted: "true", singleEvents: "true" });
      if (input.syncToken) {
        q.set("syncToken", input.syncToken);
      } else {
        // Sin token es la primera corrida: se pide solo la ventana que interesa, no la
        // historia entera del calendario.
        if (input.timeMin) q.set("timeMin", input.timeMin.toISOString());
        if (input.timeMax) q.set("timeMax", input.timeMax.toISOString());
      }
      if (input.pageToken) q.set("pageToken", input.pageToken);

      const r = await pedir<{
        items?: GoogleEvent[];
        nextSyncToken?: string;
        nextPageToken?: string;
      }>(`/calendars/${encodeURIComponent(input.calendarId)}/events?${q.toString()}`);

      return {
        events: r.items ?? [],
        nextSyncToken: r.nextSyncToken ?? null,
        nextPageToken: r.nextPageToken ?? null,
      };
    },
  };
}
