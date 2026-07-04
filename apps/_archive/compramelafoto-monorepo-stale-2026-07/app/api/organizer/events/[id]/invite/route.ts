import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { haversineDistanceMeters } from "@/lib/geo";

const INVITE_RADIUS_KM = 50;
const INVITE_RADIUS_METERS = INVITE_RADIUS_KM * 1000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/organizer/events/[id]/invite
 * Envía invitaciones a fotógrafos de la zona (misma ciudad): email + notificación en el panel.
 * Incluye descripción del evento, instrucciones de acreditación y cupo máximo de fotógrafos.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { id } = await Promise.resolve(params);
    const eventId = parseInt(id, 10);
    if (!Number.isFinite(eventId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
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
        creatorId: true,
        latitude: true,
        longitude: true,
      },
    });
    if (!event || event.creatorId !== user.id) {
      return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
    }

    const creatorName = user.name || user.email || "El organizador";
    const eventTypeLabel: Record<string, string> = {
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
    const typeLabel = eventTypeLabel[event.type] || event.type;
    const startsAtStr = new Date(event.startsAt).toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });

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
    bodyText += `\nEntrá a tu panel de fotógrafo para unirte al evento y subir fotos.`;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (req.nextUrl ? new URL(req.url).origin : "") || "";
    const link = "/fotografo/dashboard";
    const dashboardUrl = `${baseUrl.replace(/\/$/, "")}${link}`;
    const notificationTitle = `Invitación: ${event.title}`;
    const notificationBody = [
      event.description ? event.description.slice(0, 150) + (event.description.length > 150 ? "…" : "") : null,
      event.maxPhotographers ? `Cupo: ${event.maxPhotographers} fotógrafos.` : null,
      event.accreditationNotes ? `Acreditación: ${event.accreditationNotes.slice(0, 100)}…` : null,
    ]
      .filter(Boolean)
      .join(" ");

    const allCandidates = await prisma.user.findMany({
      where: {
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
        isBlocked: false,
      },
      select: { id: true, email: true, name: true, city: true, latitude: true, longitude: true },
    });

    const eventLat = event.latitude ?? 0;
    const eventLng = event.longitude ?? 0;
    const eventHasCoords = Number.isFinite(eventLat) && Number.isFinite(eventLng) && (eventLat !== 0 || eventLng !== 0);

    const photographerIds = new Set<number>();
    for (const ph of allCandidates) {
      const hasCoords = ph.latitude != null && ph.longitude != null && Number.isFinite(ph.latitude) && Number.isFinite(ph.longitude);
      if (eventHasCoords && hasCoords) {
        const distM = haversineDistanceMeters(eventLat, eventLng, ph.latitude!, ph.longitude!);
        if (distM <= INVITE_RADIUS_METERS) {
          photographerIds.add(ph.id);
        }
      }
      if (!photographerIds.has(ph.id) && event.city && ph.city) {
        if (ph.city.trim().toLowerCase() === event.city.trim().toLowerCase()) {
          photographerIds.add(ph.id);
        }
      }
    }

    const photographers = allCandidates.filter((ph) => photographerIds.has(ph.id));

    if (photographers.length === 0) {
      return NextResponse.json({
        ok: true,
        invited: 0,
        message: eventHasCoords
          ? `No hay fotógrafos a menos de ${INVITE_RADIUS_KM} km ni en la misma ciudad para invitar.`
          : "No hay fotógrafos en la misma ciudad para invitar. Configurá la ubicación del evento en el mapa.",
      });
    }

    let invited = 0;
    for (const ph of photographers) {
      try {
        await prisma.dashboardNotification.create({
          data: {
            userId: ph.id,
            type: "EVENT_INVITATION",
            title: notificationTitle,
            body: notificationBody || undefined,
            link: `${link}?eventId=${event.id}`,
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
            <p><strong>${creatorName}</strong> te invita al evento:</p>
            <h2>${event.title}</h2>
            <p><strong>Tipo:</strong> ${typeLabel}<br/>
            <strong>Fecha:</strong> ${startsAtStr}<br/>
            <strong>Lugar:</strong> ${event.locationName || event.city || "—"}</p>
            ${event.maxPhotographers ? `<p><strong>Cupo máximo de fotógrafos:</strong> ${event.maxPhotographers}</p>` : ""}
            ${event.description ? `<p><strong>Descripción del evento:</strong></p><p>${event.description.replace(/\n/g, "<br/>")}</p>` : ""}
            ${event.accreditationNotes ? `<p><strong>Instrucciones para acreditarse:</strong></p><p>${event.accreditationNotes.replace(/\n/g, "<br/>")}</p>` : ""}
            <p>Entrá a tu <a href="${dashboardUrl}">panel de fotógrafo</a> para unirte al evento y subir fotos.</p>
          `,
        });
        invited++;
      } catch (e) {
        console.warn("Error enviando email a", ph.email, e);
      }
    }

    return NextResponse.json({
      ok: true,
      invited,
      total: photographers.length,
      message: `Se enviaron ${invited} invitación(es) por email y notificación en el panel.`,
    });
  } catch (err: any) {
    console.error("POST /api/organizer/events/[id]/invite ERROR >>>", err);
    return NextResponse.json(
      { error: "Error enviando invitaciones", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
