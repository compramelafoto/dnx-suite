/**
 * GET /api/public/events
 * Eventos y álbumes públicos para el home. Sin auth.
 * - q: buscar por nombre (evento o álbum)
 * - lat, lng: filtrar cerca (radio 50km), ordenar de más cercano a más lejano
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistanceMeters } from "@/lib/geo";
import { getR2PublicUrl, normalizePreviewUrl } from "@/lib/r2-client";
import { publicAlbumFilter } from "@/lib/album-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RADIUS_KM = 50;

const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival",
  CONFERENCE: "Conferencia",
  CONCERT: "Recital",
  CORPORATE: "Corporativo",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
  OTHER: "Otro",
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 200) || "";
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;
    const hasLocation = lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

    const now = new Date();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

    const result: Array<{
      id: number;
      title: string;
      type: string;
      typeLabel: string;
      city: string | null;
      locationName: string | null;
      startsAt: Date | null;
      shareSlug: string | null;
      distanceKm: number | null;
      isPast: boolean;
      coverUrl: string | null;
      joinUrl: string | null;
      source: "EVENT" | "ALBUM";
    }> = [];

    // 1. Eventos (Event con shareSlug) - búsqueda por cualquier campo
    const eventWhere: any = {
      shareSlug: { not: null },
      archivedAt: null,
    };
    if (q) {
      eventWhere.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { locationName: { contains: q, mode: "insensitive" } },
        { shareSlug: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const events = await prisma.event.findMany({
      where: eventWhere,
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
      take: 100,
    });

    events.forEach((e) => {
      const distanceKm =
        hasLocation && e.latitude != null && e.longitude != null
          ? Math.round((haversineDistanceMeters(lat!, lng!, e.latitude, e.longitude) / 1000) * 10) / 10
          : null;
      result.push({
        id: e.id,
        title: e.title,
        type: e.type,
        typeLabel: EVENT_TYPE_LABELS[e.type] ?? e.type,
        city: e.city,
        locationName: e.locationName,
        startsAt: e.startsAt,
        shareSlug: e.shareSlug,
        distanceKm,
        isPast: e.startsAt < now,
        coverUrl: e.coverImageKey ? getR2PublicUrl(e.coverImageKey) : null,
        joinUrl: e.shareSlug ? `${baseUrl}/e/${e.shareSlug}` : null,
        source: "EVENT",
      });
    });

    // 2. Álbumes públicos (Album) - búsqueda por cualquier campo
    const albumWhere: any = {
      ...publicAlbumFilter(),
      deletedAt: null,
    };
    if (q) {
      albumWhere.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { publicSlug: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { companyName: { contains: q, mode: "insensitive" } } },
      ];
    }

    const albums = await prisma.album.findMany({
      where: albumWhere,
      select: {
        id: true,
        title: true,
        type: true,
        city: true,
        location: true,
        startsAt: true,
        eventDate: true,
        publicSlug: true,
        latitude: true,
        longitude: true,
        coverThumbnailKey: true,
        coverPhoto: { select: { originalKey: true, previewUrl: true } },
        photos: { take: 1, orderBy: { createdAt: "asc" }, select: { originalKey: true, previewUrl: true } },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    albums.forEach((a) => {
      const distanceKm =
        hasLocation && a.latitude != null && a.longitude != null
          ? Math.round((haversineDistanceMeters(lat!, lng!, a.latitude, a.longitude) / 1000) * 10) / 10
          : null;
      const startsAt = a.startsAt ?? a.eventDate;
      let coverUrl: string | null = null;
      if (a.coverThumbnailKey) coverUrl = getR2PublicUrl(a.coverThumbnailKey);
      else if (a.coverPhoto) {
        const cp = a.coverPhoto as { originalKey?: string; previewUrl?: string };
        coverUrl = normalizePreviewUrl(cp.previewUrl, cp.originalKey) ?? (cp.originalKey ? getR2PublicUrl(cp.originalKey) : null);
      } else if (a.photos?.[0]) {
        const p = a.photos[0] as { originalKey?: string; previewUrl?: string };
        coverUrl = normalizePreviewUrl(p.previewUrl, p.originalKey) ?? (p.originalKey ? getR2PublicUrl(p.originalKey) : null);
      }
      result.push({
        id: a.id,
        title: a.title,
        type: (a.type as string) ?? "OTHER",
        typeLabel: EVENT_TYPE_LABELS[(a.type as string) ?? ""] ?? "Álbum",
        city: a.city,
        locationName: a.location,
        startsAt,
        shareSlug: a.publicSlug,
        distanceKm,
        isPast: startsAt ? new Date(startsAt) < now : false,
        coverUrl,
        joinUrl: `${baseUrl}/a/${a.publicSlug}`,
        source: "ALBUM",
      });
    });

    // Si hay ubicación: ordenar por cercanía (con coords primero), incluir también los sin coords
    if (hasLocation) {
      const withDistance = result.filter((e) => e.distanceKm != null && e.distanceKm <= RADIUS_KM);
      const withoutDistance = result.filter((e) => e.distanceKm == null);
      withDistance.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      const sorted = [...withDistance, ...withoutDistance];
      return NextResponse.json({
        events: sorted,
        radiusKm: RADIUS_KM,
        hasLocation,
      });
    }

    // Sin ubicación: ordenar por fecha (más recientes primero)
    result.sort((a, b) => {
      const da = a.startsAt ? new Date(a.startsAt).getTime() : 0;
      const db = b.startsAt ? new Date(b.startsAt).getTime() : 0;
      return db - da;
    });

    return NextResponse.json({
      events: result,
      radiusKm: RADIUS_KM,
      hasLocation: false,
    });
  } catch (err: unknown) {
    console.error("GET /api/public/events ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error listando eventos",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
