import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodeGeohash } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_EVENT_TYPES = [
  "PUBLIC_SESSION",
  "PRIVATE_SESSION",
  "SPORTS",
  "PUBLIC_PHOTOGRAPHY",
  "THEMATIC_SESSIONS",
  "COMMERCIAL_SESSIONS",
  "SCHOOL",
  "RELIGIOUS",
  "FESTIVAL",
  "CONFERENCE",
  "CONCERT",
  "CORPORATE",
  "OTHER",
  "WEDDING",
  "BIRTHDAY",
  "GRADUATION",
];

export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || "";
    const where: Record<string, unknown> = {};
    if (q) {
      const qNum = parseInt(q, 10);
      if (!Number.isNaN(qNum)) {
        where.id = qNum;
      } else {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { city: { contains: q, mode: "insensitive" } },
        ];
      }
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startsAt: "desc" },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        members: {
          where: { role: "PHOTOGRAPHER", status: "ACTIVE" },
          include: { user: { select: { id: true, name: true, email: true, companyName: true, phone: true } } },
        },
        _count: { select: { members: true, albums: true } },
      },
      take: 200,
    });

    return NextResponse.json(
      events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        city: e.city,
        locationName: e.locationName,
        visibility: e.visibility,
        joinPolicy: e.joinPolicy,
        maxPhotographers: e.maxPhotographers,
        expectedAttendees: e.expectedAttendees,
        shareSlug: e.shareSlug ?? null,
        coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
        creator: e.creator,
        membersCount: e._count.members,
        albumsCount: e._count.albums,
        photographers: e.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          companyName: m.user.companyName,
          phone: m.user.phone,
          joinedAt: m.createdAt,
        })),
      }))
    );
  } catch (err: any) {
    console.error("GET /api/admin/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error listando eventos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
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
    } = body;

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }
    if (!type || !VALID_EVENT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Tipo de evento inválido" }, { status: 400 });
    }
    const parsedStartsAt = startsAt ? new Date(startsAt) : null;
    if (!parsedStartsAt || Number.isNaN(parsedStartsAt.getTime())) {
      return NextResponse.json({ error: "Fecha de inicio requerida" }, { status: 400 });
    }
    const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
    const lng = longitude != null ? parseFloat(String(longitude)) : NaN;
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
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
        endsAt: endsAtDate && !Number.isNaN(endsAtDate.getTime()) ? endsAtDate : null,
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

    return NextResponse.json(event);
  } catch (err: any) {
    console.error("POST /api/admin/events ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando evento", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
