import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { encodeGeohash, geohashPrefixForRadiusKm, haversineDistanceMeters, hoursDiff } from "@/lib/geo";
import { EventType } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DISTANCE_M = 5000;
const MAX_HOURS_DIFF = 6;

function sameCalendarDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

type Candidate = {
  kind: "event" | "album";
  id: number;
  title: string;
  type?: EventType;
  location?: string | null;
  city?: string | null;
  startsAt?: string | null;
  distanceM?: number;
  hoursDiff?: number;
  creatorName?: string | null;
};

// POST: Buscar candidatos por geo+tiempo (distance <= 2km, time diff <= 6h)
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const { title, type, startsAt, lat, lng, city } = body;

    const parsedStartsAt = startsAt ? new Date(startsAt) : null;
    if (!parsedStartsAt || isNaN(parsedStartsAt.getTime())) {
      return NextResponse.json({ candidates: [] });
    }

    const parsedLat = lat != null ? parseFloat(String(lat)) : NaN;
    const parsedLng = lng != null ? parseFloat(String(lng)) : NaN;
    const hasGeo = !isNaN(parsedLat) && !isNaN(parsedLng);

    if (!hasGeo) {
      return NextResponse.json({ candidates: [] });
    }

    const geohash = encodeGeohash(parsedLat, parsedLng);
    const prefixLen = geohashPrefixForRadiusKm(MAX_DISTANCE_M / 1000);
    const prefix = geohash.slice(0, prefixLen);

    const candidates: Candidate[] = [];

    // 1. Buscar Events: por geohash o con lat/lng (por si geohash es null)
    try {
      const eventsByGeohash = await prisma.event.findMany({
        where: {
          geohash: { not: null, startsWith: prefix },
          visibility: { in: ["PUBLIC", "UNLISTED"] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          startsAt: true,
          latitude: true,
          longitude: true,
          locationName: true,
          city: true,
          creator: { select: { name: true } },
        },
      });
      const eventsNoGeohash = await prisma.event.findMany({
        where: {
          geohash: null,
          visibility: { in: ["PUBLIC", "UNLISTED"] },
        },
        select: {
          id: true,
          title: true,
          type: true,
          startsAt: true,
          latitude: true,
          longitude: true,
          locationName: true,
          city: true,
          creator: { select: { name: true } },
        },
      });
      const seenEventIds = new Set<number>();
      const events = [...eventsByGeohash];
      for (const e of eventsNoGeohash) {
        if (seenEventIds.has(e.id)) continue;
        const dist = haversineDistanceMeters(parsedLat, parsedLng, e.latitude!, e.longitude!);
        if (dist <= MAX_DISTANCE_M) {
          seenEventIds.add(e.id);
          events.push(e);
        }
      }

      for (const e of events) {
        if (e.latitude == null || e.longitude == null) continue;
        const dist = haversineDistanceMeters(parsedLat, parsedLng, e.latitude, e.longitude);
        if (dist > MAX_DISTANCE_M) continue;
        const eventStart = new Date(e.startsAt);
        const hDiff = hoursDiff(parsedStartsAt, eventStart);
        const sameDay = sameCalendarDay(parsedStartsAt, eventStart);
        if (!sameDay && hDiff > MAX_HOURS_DIFF) continue;
        candidates.push({
          kind: "event",
          id: e.id,
          title: e.title,
          type: e.type,
          location: e.locationName,
          city: e.city ?? null,
          startsAt: e.startsAt.toISOString(),
          distanceM: Math.round(dist),
          hoursDiff: Math.round(hDiff * 10) / 10,
          creatorName: e.creator?.name ?? null,
        });
      }
    } catch (e) {
      // Tabla Event puede no existir aún
    }

    // 2. Buscar Albums (sin event o con event) con geo
    try {
      const albums = await prisma.album.findMany({
        where: {
          geohash: { startsWith: prefix },
          latitude: { not: null },
          longitude: { not: null },
          isPublic: true,
          isHidden: false,
          deletedAt: null,
          userId: { not: user.id },
        },
        select: {
          id: true,
          title: true,
          type: true,
          location: true,
          city: true,
          startsAt: true,
          eventDate: true,
          createdAt: true,
          latitude: true,
          longitude: true,
          user: { select: { name: true } },
        },
      });

      for (const a of albums) {
        const alat = a.latitude ?? 0;
        const alng = a.longitude ?? 0;
        const dist = haversineDistanceMeters(parsedLat, parsedLng, alat, alng);
        if (dist > MAX_DISTANCE_M) continue;
        const astart = (a as any).startsAt ?? (a as any).eventDate ?? (a as any).createdAt;
        const albumStart = new Date(astart);
        const hDiff = hoursDiff(parsedStartsAt, albumStart);
        const sameDay = sameCalendarDay(parsedStartsAt, albumStart);
        if (!sameDay && hDiff > MAX_HOURS_DIFF) continue;
        candidates.push({
          kind: "album",
          id: a.id,
          title: a.title,
          type: a.type ?? undefined,
          location: a.location,
          city: a.city ?? null,
          startsAt: a.startsAt ? new Date(a.startsAt).toISOString() : null,
          distanceM: Math.round(dist),
          hoursDiff: Math.round(hDiff * 10) / 10,
          creatorName: a.user?.name ?? null,
        });
      }
    } catch (e) {
      // Campos geo pueden no existir
    }

    // Ordenar por distancia
    candidates.sort((a, b) => (a.distanceM ?? 999999) - (b.distanceM ?? 999999));

    return NextResponse.json({ candidates });
  } catch (err: any) {
    console.error("POST /api/dashboard/albums/preview-candidates ERROR >>>", err);
    return NextResponse.json(
      { error: "Error buscando candidatos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
