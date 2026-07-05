import { EventVisibility, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { haversineDistanceMeters } from "@/lib/geo";
import { resolveWorkingCoverageRadiusForEvents } from "@/lib/photographer/working-coverage-radius";
import {
  getPublicSiteOrigin,
  publicEventJoinPath,
} from "@/lib/public-site-url";
import { ensureEventShareSlug } from "@/lib/ensure-event-share-slug";

export const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  THEMATIC_SESSIONS: "Sesiones temáticas",
  COMMERCIAL_SESSIONS: "Sesiones comerciales",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival / Fiesta popular",
  CONFERENCE: "Conferencia / Charla",
  CONCERT: "Recital / Concierto",
  CORPORATE: "Corporativo",
  OTHER: "Otro",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
};

export type NearbyPhotographerCandidate = {
  id: number;
  email: string;
  name: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export type EventForNearbyInvite = {
  id: number;
  title: string;
  description: string | null;
  accreditationNotes: string | null;
  maxPhotographers: number | null;
  city: string;
  type: string;
  startsAt: Date;
  locationName: string | null;
  latitude: number;
  longitude: number;
  visibility: EventVisibility;
  creatorId: number;
  shareSlug: string | null;
};

export function eventHasValidCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/**
 * Fotógrafos dentro del radio configurado en su perfil respecto al evento.
 */
export async function findPhotographersNearEvent(
  event: Pick<EventForNearbyInvite, "latitude" | "longitude" | "city">
): Promise<NearbyPhotographerCandidate[]> {
  const eventLat = event.latitude;
  const eventLng = event.longitude;
  const eventHasCoords = eventHasValidCoordinates(eventLat, eventLng);

  const allCandidates = await prisma.user.findMany({
    where: {
      role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
      isBlocked: false,
    },
    select: {
      id: true,
      email: true,
      name: true,
      city: true,
      latitude: true,
      longitude: true,
      workingCoverageRadiusKm: true,
    },
  });

  const results: NearbyPhotographerCandidate[] = [];

  for (const ph of allCandidates) {
    const hasCoords =
      ph.latitude != null &&
      ph.longitude != null &&
      Number.isFinite(ph.latitude) &&
      Number.isFinite(ph.longitude);

    if (eventHasCoords && hasCoords) {
      const distM = haversineDistanceMeters(eventLat, eventLng, ph.latitude!, ph.longitude!);
      const distanceKm = Math.round((distM / 1000) * 10) / 10;
      const radiusKm = resolveWorkingCoverageRadiusForEvents(ph.workingCoverageRadiusKm);
      const unlimited = radiusKm === null;
      if (unlimited || distanceKm <= radiusKm!) {
        results.push({
          id: ph.id,
          email: ph.email,
          name: ph.name,
          latitude: ph.latitude!,
          longitude: ph.longitude!,
          distanceKm,
        });
      }
      continue;
    }

    if (!eventHasCoords && event.city && ph.city) {
      if (ph.city.trim().toLowerCase() === event.city.trim().toLowerCase()) {
        results.push({
          id: ph.id,
          email: ph.email,
          name: ph.name,
          latitude: ph.latitude ?? 0,
          longitude: ph.longitude ?? 0,
          distanceKm: 0,
        });
      }
    }
  }

  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

export type NotifyNearbyPhotographersResult = {
  ok: true;
  found: number;
  invited: number;
  skippedAlreadyNotified: number;
  message: string;
};

export type NotifyNearbyPhotographersOptions = {
  eventId: number;
  creatorName: string;
  /** Si true, marca nearbyPhotographersAutoNotifiedAt al finalizar (convocatoria automática). */
  markAutoNotified?: boolean;
};

/**
 * Envía email + notificación in-app a fotógrafos cercanos que aún no fueron notificados.
 * Solo procede si el evento es PUBLIC.
 */
export async function notifyNearbyPhotographersForEvent(
  options: NotifyNearbyPhotographersOptions
): Promise<NotifyNearbyPhotographersResult> {
  const event = await prisma.event.findUnique({
    where: { id: options.eventId },
    select: {
      id: true,
      title: true,
      description: true,
      accreditationNotes: true,
      maxPhotographers: true,
      city: true,
      type: true,
      startsAt: true,
      locationName: true,
      latitude: true,
      longitude: true,
      visibility: true,
      creatorId: true,
      shareSlug: true,
    },
  });

  if (!event) {
    throw new Error("Evento no encontrado");
  }

  if (event.visibility !== EventVisibility.PUBLIC) {
    return {
      ok: true,
      found: 0,
      invited: 0,
      skippedAlreadyNotified: 0,
      message: "El evento no es público; no se enviaron invitaciones.",
    };
  }

  const shareSlug = event.shareSlug ?? (await ensureEventShareSlug(event.id));
  const photographers = await findPhotographersNearEvent(event);

  if (photographers.length === 0) {
    if (options.markAutoNotified) {
      await prisma.event.update({
        where: { id: event.id },
        data: { nearbyPhotographersAutoNotifiedAt: new Date() },
      });
    }
    return {
      ok: true,
      found: 0,
      invited: 0,
      skippedAlreadyNotified: 0,
      message:
        "No se encontraron fotógrafos cercanos según la configuración de distancia disponible.",
    };
  }

  const alreadyNotified = await prisma.eventNearbyPhotographerNotification.findMany({
    where: { eventId: event.id, userId: { in: photographers.map((p) => p.id) } },
    select: { userId: true },
  });
  const alreadySet = new Set(alreadyNotified.map((r) => r.userId));
  const toNotify = photographers.filter((p) => !alreadySet.has(p.id));

  const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type;
  const startsAtStr = new Date(event.startsAt).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  const baseUrl = getPublicSiteOrigin();
  const joinUrl = `${baseUrl}${publicEventJoinPath(shareSlug)}`;
  const dashboardLink = `/fotografo/dashboard?eventId=${event.id}`;

  let bodyText = `Invitación a evento: ${event.title}\n\n`;
  bodyText += `Tipo: ${typeLabel}\n`;
  bodyText += `Fecha: ${startsAtStr}\n`;
  bodyText += `Lugar: ${event.locationName || event.city || "—"}\n`;
  if (event.maxPhotographers) {
    bodyText += `Cupo máximo de fotógrafos: ${event.maxPhotographers}\n`;
  }
  if (event.description) {
    bodyText += `\nDescripción del evento:\n${event.description}\n`;
  }
  if (event.accreditationNotes) {
    bodyText += `\nInstrucciones para acreditarse:\n${event.accreditationNotes}\n`;
  }
  bodyText += `\nEntrá al evento para inscribirte y subir fotos:\n${joinUrl}`;

  const notificationTitle = `Invitación: ${event.title}`;
  const notificationBody = [
    event.description
      ? event.description.slice(0, 150) + (event.description.length > 150 ? "…" : "")
      : null,
    event.maxPhotographers ? `Cupo: ${event.maxPhotographers} fotógrafos.` : null,
    event.accreditationNotes
      ? `Acreditación: ${event.accreditationNotes.slice(0, 100)}…`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  let invited = 0;
  for (const ph of toNotify) {
    try {
      await prisma.dashboardNotification.create({
        data: {
          userId: ph.id,
          type: "EVENT_INVITATION",
          title: notificationTitle,
          body: notificationBody || undefined,
          link: dashboardLink,
        },
      });
    } catch (e) {
      console.warn("Error creando notificación para", ph.id, e);
    }

    try {
      await sendEmail({
        to: ph.email,
        subject: `Invitación a evento: ${event.title}`,
        text: bodyText,
        html: `
          <p>Hola${ph.name ? ` ${ph.name}` : ""},</p>
          <p><strong>${options.creatorName}</strong> te invita al evento:</p>
          <h2>${event.title}</h2>
          <p><strong>Tipo:</strong> ${typeLabel}<br/>
          <strong>Fecha:</strong> ${startsAtStr}<br/>
          <strong>Lugar:</strong> ${event.locationName || event.city || "—"}</p>
          ${event.maxPhotographers ? `<p><strong>Cupo máximo de fotógrafos:</strong> ${event.maxPhotographers}</p>` : ""}
          ${event.description ? `<p><strong>Descripción del evento:</strong></p><p>${event.description.replace(/\n/g, "<br/>")}</p>` : ""}
          ${event.accreditationNotes ? `<p><strong>Instrucciones para acreditarse:</strong></p><p>${event.accreditationNotes.replace(/\n/g, "<br/>")}</p>` : ""}
          <p><a href="${joinUrl}">Ver evento e inscribirme</a></p>
          <p>También podés entrar desde tu <a href="${baseUrl}${dashboardLink}">panel de fotógrafo</a>.</p>
        `,
      });

      await prisma.eventNearbyPhotographerNotification.create({
        data: { eventId: event.id, userId: ph.id },
      });
      invited++;
    } catch (e) {
      console.warn("Error enviando email a", ph.email, e);
    }
  }

  if (options.markAutoNotified) {
    await prisma.event.update({
      where: { id: event.id },
      data: { nearbyPhotographersAutoNotifiedAt: new Date() },
    });
  }

  if (invited === 0 && toNotify.length > 0) {
    return {
      ok: true,
      found: photographers.length,
      invited: 0,
      skippedAlreadyNotified: alreadySet.size,
      message: "No pudimos enviar la invitación a los fotógrafos cercanos. Intentá nuevamente.",
    };
  }

  if (invited === 0) {
    return {
      ok: true,
      found: photographers.length,
      invited: 0,
      skippedAlreadyNotified: alreadySet.size,
      message:
        photographers.length === 0
          ? "No se encontraron fotógrafos cercanos según la configuración de distancia disponible."
          : "Se envió un email notificando a los fotógrafos cercanos.",
    };
  }

  return {
    ok: true,
    found: photographers.length,
    invited,
    skippedAlreadyNotified: alreadySet.size,
    message: "Se envió un email notificando a los fotógrafos cercanos.",
  };
}

/**
 * Dispara convocatoria automática si el evento es público y aún no se notificó automáticamente.
 */
export async function triggerAutoNearbyPhotographerInviteIfNeeded(
  eventId: number,
  creatorId: number,
  creatorName: string
): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      visibility: true,
      nearbyPhotographersAutoNotifiedAt: true,
    },
  });
  if (!event || event.visibility !== EventVisibility.PUBLIC) return;
  if (event.nearbyPhotographersAutoNotifiedAt) return;

  try {
    await notifyNearbyPhotographersForEvent({
      eventId,
      creatorName,
      markAutoNotified: true,
    });
  } catch (err) {
    console.error("triggerAutoNearbyPhotographerInviteIfNeeded ERROR >>>", err);
  }
}

/**
 * Dispara convocatoria automática al pasar de no-público a público (una sola vez).
 */
export async function triggerAutoNearbyPhotographerInviteOnVisibilityChange(
  eventId: number,
  previousVisibility: EventVisibility,
  newVisibility: EventVisibility,
  creatorName: string
): Promise<void> {
  if (newVisibility !== EventVisibility.PUBLIC) return;
  if (previousVisibility === EventVisibility.PUBLIC) return;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { nearbyPhotographersAutoNotifiedAt: true },
  });
  if (event?.nearbyPhotographersAutoNotifiedAt) return;

  try {
    await notifyNearbyPhotographersForEvent({
      eventId,
      creatorName,
      markAutoNotified: true,
    });
  } catch (err) {
    console.error("triggerAutoNearbyPhotographerInviteOnVisibilityChange ERROR >>>", err);
  }
}
