import "server-only";
import { prisma } from "@repo/db";
import { sanitizeError } from "@/lib/payments/connect/log";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { BOOKINGS_TIME_ZONE, addMinutes } from "../time";
import { createCalendarClient, type CalendarClient } from "./client";
import { buildEventDescription, buildEventSummary } from "./event-content";
import { decideForEvent, isSyncTokenExpired } from "./sync-decisions";

/**
 * El espejo con Google Calendar, en las dos direcciones.
 *
 * ── Google es un reflejo, no el registro ──
 *
 * Ninguna función de acá puede impedir una reserva. Si Google está caído, desconectado o el
 * permiso fue revocado, todo devuelve un resultado con su motivo y la reserva sigue su vida.
 * Lo que queda pendiente lo recupera la corrida siguiente: **una reserva confirmada sin
 * `googleEventId` es la cola de pendientes**, y por eso no hace falta ninguna tabla extra.
 */

export type SyncReport = {
  espaciosMirados: number;
  eventosCreados: number;
  eventosBorrados: number;
  bloqueosCreados: number;
  bloqueosBorrados: number;
  motivo?: string;
};

const VENTANA_DIAS = 90;

/** El cliente para un workspace, o el motivo por el que no hay. */
async function clienteDe(
  workspaceId: string,
): Promise<{ ok: true; client: CalendarClient } | { ok: false; motivo: string }> {
  const token = await getGoogleAccessToken(workspaceId, GOOGLE_CALENDAR_INTEGRATION_KEY);
  if (!token.ok) {
    const motivos: Record<string, string> = {
      NOT_CONNECTED: "la institución no conectó su cuenta de Google",
      NEEDS_RECONSENT: "el permiso de Google fue revocado y hay que volver a conectar",
      CONFIG: "falta configurar las credenciales de Google en la plataforma",
      UNAVAILABLE: "Google no está respondiendo",
    };
    return { ok: false, motivo: motivos[token.reason] ?? "no se pudo obtener el permiso" };
  }
  return { ok: true, client: createCalendarClient(token.accessToken) };
}

/**
 * De ida: crea en Google los eventos de las reservas confirmadas que todavía no lo tienen.
 *
 * Idempotente: una reserva con `googleEventId` no se vuelve a crear.
 */
export async function pushPendingEvents(
  workspaceId: string,
  client: CalendarClient,
): Promise<{ creados: number }> {
  const pendientes = await prisma.booking.findMany({
    where: {
      workspaceId,
      status: "CONFIRMED",
      googleEventId: null,
      endAt: { gte: new Date() },
      space: { googleCalendarId: { not: null } },
    },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      member: { select: { memberNumber: true, phone: true } },
      extraLines: {
        select: { nameSnapshot: true, unitsConsumed: true, amountArs: true, status: true },
      },
      space: { select: { name: true, googleCalendarId: true } },
    },
    take: 100,
  });

  let creados = 0;
  for (const r of pendientes) {
    try {
      // Todo lo que la Secretaría necesita saber va en el evento. Ver `event-content.ts`.
      const contenido = {
        spaceName: r.space.name,
        contactName: r.contactName,
        contactEmail: r.contactEmail,
        contactPhone: r.contactPhone,
        memberPhone: r.member?.phone ?? null,
        memberNumber: r.member?.memberNumber ?? null,
        extras: r.extraLines.map((l) => ({
          name: l.nameSnapshot,
          units: l.unitsConsumed,
          amountArs: l.amountArs.toString(),
          status: l.status,
        })),
      };
      const eventId = await client.createEvent({
        calendarId: r.space.googleCalendarId as string,
        bookingId: r.id,
        summary: buildEventSummary(contenido),
        description: buildEventDescription(contenido),
        startAt: r.startAt,
        endAt: r.endAt,
        timeZone: BOOKINGS_TIME_ZONE,
      });
      await prisma.booking.update({ where: { id: r.id }, data: { googleEventId: eventId } });
      creados += 1;
    } catch (error) {
      // Una reserva que falla no puede frenar a las demás: queda para la corrida siguiente.
      console.error("[fotoffice][calendar] no se pudo crear el evento", {
        bookingId: r.id,
        detalle: sanitizeError(error),
      });
    }
  }
  return { creados };
}

/**
 * De ida, la otra mitad: borra en Google los eventos de las reservas que dejaron de estar
 * activas.
 */
export async function pushCancellations(
  workspaceId: string,
  client: CalendarClient,
): Promise<{ borrados: number }> {
  const canceladas = await prisma.booking.findMany({
    where: {
      workspaceId,
      status: { in: ["CANCELLED", "EXPIRED"] },
      googleEventId: { not: null },
      space: { googleCalendarId: { not: null } },
    },
    select: { id: true, googleEventId: true, space: { select: { googleCalendarId: true } } },
    take: 100,
  });

  let borrados = 0;
  for (const r of canceladas) {
    try {
      await client.deleteEvent(r.space.googleCalendarId as string, r.googleEventId as string);
      await prisma.booking.update({ where: { id: r.id }, data: { googleEventId: null } });
      borrados += 1;
    } catch (error) {
      console.error("[fotoffice][calendar] no se pudo borrar el evento", {
        bookingId: r.id,
        detalle: sanitizeError(error),
      });
    }
  }
  return { borrados };
}

/**
 * De vuelta: trae los cambios del calendario de un espacio y los convierte en bloqueos.
 *
 * Usa el `syncToken` para pedir solo lo que cambió. Si Google lo rechaza con un 410, el
 * token venció: se borra y se recarga la ventana entera, que es lo que Google mismo indica.
 */
export async function pullBlocksForSpace(input: {
  spaceId: string;
  calendarId: string;
  syncToken: string | null;
  client: CalendarClient;
  now?: Date;
}): Promise<{ creados: number; borrados: number }> {
  const now = input.now ?? new Date();
  let creados = 0;
  let borrados = 0;

  let syncToken = input.syncToken;
  let pageToken: string | null = null;
  let nuevoSyncToken: string | null = null;

  for (let vuelta = 0; vuelta < 20; vuelta += 1) {
    let pagina;
    try {
      pagina = await input.client.listChanges({
        calendarId: input.calendarId,
        syncToken,
        timeMin: now,
        timeMax: addMinutes(now, VENTANA_DIAS * 24 * 60),
        pageToken,
      });
    } catch (error) {
      if (isSyncTokenExpired(error) && syncToken) {
        // El token venció. Se recarga la ventana entera una sola vez.
        await prisma.bookingSpace.update({
          where: { id: input.spaceId },
          data: { calendarSyncToken: null },
        });
        syncToken = null;
        pageToken = null;
        continue;
      }
      throw error;
    }

    for (const evento of pagina.events) {
      const d = decideForEvent(evento);
      if (d.kind === "IGNORE") continue;

      if (d.kind === "DELETE") {
        const r = await prisma.bookingCalendarBlock.deleteMany({
          where: { spaceId: input.spaceId, googleEventId: d.eventId },
        });
        borrados += r.count;
        continue;
      }

      await prisma.bookingCalendarBlock.upsert({
        where: {
          spaceId_googleEventId: { spaceId: input.spaceId, googleEventId: d.eventId },
        },
        create: {
          spaceId: input.spaceId,
          googleEventId: d.eventId,
          startAt: d.range.startAt,
          endAt: d.range.endAt,
          summary: d.summary,
        },
        update: { startAt: d.range.startAt, endAt: d.range.endAt, summary: d.summary },
      });
      creados += 1;
    }

    if (pagina.nextSyncToken) nuevoSyncToken = pagina.nextSyncToken;
    if (!pagina.nextPageToken) break;
    pageToken = pagina.nextPageToken;
  }

  if (nuevoSyncToken) {
    await prisma.bookingSpace.update({
      where: { id: input.spaceId },
      data: { calendarSyncToken: nuevoSyncToken },
    });
  }

  return { creados, borrados };
}

/** Una corrida completa para un workspace. Nunca lanza: devuelve el motivo. */
export async function syncWorkspaceCalendar(workspaceId: string): Promise<SyncReport> {
  const vacio: SyncReport = {
    espaciosMirados: 0,
    eventosCreados: 0,
    eventosBorrados: 0,
    bloqueosCreados: 0,
    bloqueosBorrados: 0,
  };

  const cliente = await clienteDe(workspaceId);
  if (!cliente.ok) return { ...vacio, motivo: cliente.motivo };

  const espacios = await prisma.bookingSpace.findMany({
    where: { workspaceId, googleCalendarId: { not: null } },
    select: { id: true, googleCalendarId: true, calendarSyncToken: true },
  });
  if (espacios.length === 0) {
    return { ...vacio, motivo: "ningún espacio tiene un calendario asignado" };
  }

  const reporte: SyncReport = { ...vacio, espaciosMirados: espacios.length };

  try {
    const ida = await pushPendingEvents(workspaceId, cliente.client);
    reporte.eventosCreados = ida.creados;
    const bajas = await pushCancellations(workspaceId, cliente.client);
    reporte.eventosBorrados = bajas.borrados;
  } catch (error) {
    console.error("[fotoffice][calendar] falló el espejo de ida", {
      workspaceId,
      detalle: sanitizeError(error),
    });
  }

  for (const e of espacios) {
    try {
      const vuelta = await pullBlocksForSpace({
        spaceId: e.id,
        calendarId: e.googleCalendarId as string,
        syncToken: e.calendarSyncToken,
        client: cliente.client,
      });
      reporte.bloqueosCreados += vuelta.creados;
      reporte.bloqueosBorrados += vuelta.borrados;
    } catch (error) {
      // Un espacio que falla no frena a los demás.
      console.error("[fotoffice][calendar] falló el espejo de vuelta", {
        spaceId: e.id,
        detalle: sanitizeError(error),
      });
    }
  }

  return reporte;
}
