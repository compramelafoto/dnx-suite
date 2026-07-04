import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { EventMemberRole, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { haversineDistanceMeters } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RADIUS_KM = 50;
const RADIUS_METERS = RADIUS_KM * 1000;

const EVENT_TYPE_LABELS: Record<string, string> = {
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

/**
 * GET /api/fotografo/events-nearby
 * Eventos públicos dentro de RADIUS_KM del fotógrafo (usa su lat/lng de perfil).
 * Si no tiene ubicación configurada, devuelve noLocation: true.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { latitude: true, longitude: true },
    });

    const lat = profile?.latitude ?? null;
    const lng = profile?.longitude ?? null;
    const hasLocation = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    if (!hasLocation) {
      return NextResponse.json({ events: [], noLocation: true, radiusKm: RADIUS_KM });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Dar de baja eventos ya pasados (7+ días) con 0 fotógrafos inscritos; se mantiene el registro (archivedAt)
    await prisma.event.updateMany({
      where: {
        startsAt: { lt: sevenDaysAgo },
        archivedAt: null,
        shareSlug: { not: null },
        members: { none: { role: EventMemberRole.PHOTOGRAPHER } },
      },
      data: { archivedAt: now },
    });

    const events = await prisma.event.findMany({
      where: {
        shareSlug: { not: null },
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
        type: true,
        city: true,
        locationName: true,
        startsAt: true,
        shareSlug: true,
        latitude: true,
        longitude: true,
        coverImageKey: true,
      },
      orderBy: { startsAt: "asc" },
    });

    const eventIds = events.map((e) => e.id);
    const photographerCounts =
      eventIds.length > 0
        ? await prisma.eventMember.groupBy({
            by: ["eventId"],
            where: { eventId: { in: eventIds }, role: EventMemberRole.PHOTOGRAPHER },
            _count: { eventId: true },
          })
        : [];
    const countByEventId: Record<number, number> = {};
    for (const row of photographerCounts) {
      countByEventId[row.eventId] = row._count.eventId;
    }

    const withDistance = events
      .map((e) => {
        const distM = haversineDistanceMeters(lat!, lng!, e.latitude, e.longitude);
        return { ...e, distanceKm: Math.round((distM / 1000) * 10) / 10 };
      })
      .filter((e) => e.distanceKm <= RADIUS_KM)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const list = withDistance.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type,
      typeLabel: EVENT_TYPE_LABELS[e.type] ?? e.type,
      city: e.city,
      locationName: e.locationName,
      startsAt: e.startsAt,
      shareSlug: e.shareSlug,
      distanceKm: e.distanceKm,
      membersCount: countByEventId[e.id] ?? 0,
      isPast: e.startsAt < now,
      coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
      joinUrl: e.shareSlug ? `${baseUrl}/e/${e.shareSlug}` : null,
    }));

    return NextResponse.json({ events: list, radiusKm: RADIUS_KM });
  } catch (err: any) {
    console.error("GET /api/fotografo/events-nearby ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando eventos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
