import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodeGeohash } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/organizer/events
 * Lista los eventos creados por el organizador.
 */
export async function GET() {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const events = await prisma.event.findMany({
      where: { creatorId: user.id },
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { albums: true, members: true } },
      },
    });

    return NextResponse.json(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        latitude: e.latitude,
        longitude: e.longitude,
        locationName: e.locationName,
        city: e.city,
        visibility: e.visibility,
        joinPolicy: e.joinPolicy,
        maxPhotographers: e.maxPhotographers,
        expectedAttendees: e.expectedAttendees,
        accreditationNotes: e.accreditationNotes,
        coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
        shareSlug: e.shareSlug ?? null,
        createdAt: e.createdAt,
        albumsCount: e._count.albums,
        membersCount: e._count.members,
      }))
    );
  } catch (err: any) {
    console.error("GET /api/organizer/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando eventos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizer/events
 * Crea un nuevo evento.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ORGANIZER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      description,
      accreditationNotes,
      type,
      startsAt,
      endsAt,
      latitude,
      longitude,
      locationName,
      city,
      maxPhotographers,
      expectedAttendees,
      visibility,
      joinPolicy,
      invitedUserIds,
    } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }
    const VALID_EVENT_TYPES = ["PUBLIC_SESSION", "PRIVATE_SESSION", "SPORTS", "PUBLIC_PHOTOGRAPHY", "THEMATIC_SESSIONS", "COMMERCIAL_SESSIONS", "SCHOOL", "RELIGIOUS", "FESTIVAL", "CONFERENCE", "CONCERT", "CORPORATE", "OTHER", "WEDDING", "BIRTHDAY", "GRADUATION"];
    if (!type || !VALID_EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }
    const parsedStartsAt = startsAt ? new Date(startsAt) : null;
    if (!parsedStartsAt || isNaN(parsedStartsAt.getTime())) {
      return NextResponse.json({ error: "Fecha de inicio requerida" }, { status: 400 });
    }
    const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
    const lng = longitude != null ? parseFloat(String(longitude)) : NaN;
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: "Ubicación (lat/lng) requerida" }, { status: 400 });
    }
    const cityStr = city != null ? String(city).trim() : "";
    if (!cityStr) {
      return NextResponse.json({ error: "Ciudad requerida" }, { status: 400 });
    }

    const geohash = encodeGeohash(lat, lng);
    const endsAtDate = endsAt ? new Date(endsAt) : null;

    const event = await prisma.event.create({
      data: {
        title: String(title).trim(),
        description: description != null ? String(description).trim() || null : null,
        accreditationNotes: accreditationNotes != null ? String(accreditationNotes).trim() || null : null,
        type,
        startsAt: parsedStartsAt,
        endsAt: endsAtDate && !isNaN(endsAtDate.getTime()) ? endsAtDate : null,
        latitude: lat,
        longitude: lng,
        locationName: locationName != null ? String(locationName).trim() || null : null,
        city: cityStr,
        geohash,
        visibility: visibility === "UNLISTED" || visibility === "PRIVATE" ? visibility : "PUBLIC",
        joinPolicy: joinPolicy === "REQUEST" || joinPolicy === "INVITE_ONLY" ? joinPolicy : "OPEN",
        maxPhotographers:
          maxPhotographers != null && Number.isFinite(Number(maxPhotographers)) && Number(maxPhotographers) > 0
            ? Number(maxPhotographers)
            : null,
        expectedAttendees:
          expectedAttendees != null && Number.isFinite(Number(expectedAttendees)) && Number(expectedAttendees) > 0
            ? Number(expectedAttendees)
            : null,
        creatorId: user.id,
      },
    });

    const invitedIds = Array.isArray(invitedUserIds)
      ? invitedUserIds.filter((id: unknown) => Number.isFinite(Number(id))).map((id: unknown) => Number(id))
      : [];
    const uniqueInvited = [...new Set(invitedIds)];
    if (uniqueInvited.length > 0) {
      await prisma.eventInvitation.createMany({
        data: uniqueInvited.map((userId) => ({ eventId: event.id, userId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("POST /api/organizer/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
