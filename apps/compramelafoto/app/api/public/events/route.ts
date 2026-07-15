/**
 * GET /api/public/events
 * Eventos PUBLIC + álbumes públicos para Home. Sin auth.
 * UNLISTED/PRIVATE no aparecen en listado.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { haversineDistanceMeters } from "@/lib/geo";
import { getR2PublicUrl, coverPhotoPublicUrl } from "@/lib/r2-client";
import { publicAlbumFilter } from "@/lib/album-helpers";
import {
  EVENT_TYPE_LABELS,
  buildListableEventsWhere,
} from "@/lib/public/public-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RADIUS_KM = 50;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 200) || "";
    const latParam = searchParams.get("lat");
    const lngParam = searchParams.get("lng");
    const lat = latParam ? parseFloat(latParam) : null;
    const lng = lngParam ? parseFloat(lngParam) : null;
    const hasLocation =
      lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
    const includeEventSubalbums = Boolean(q) || hasLocation;

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
      photographerName: string | null;
    }> = [];

    const events = await prisma.event.findMany({
      where: buildListableEventsWhere(q),
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

    for (const e of events) {
      const distanceKm =
        hasLocation && e.latitude != null && e.longitude != null
          ? Math.round(
              (haversineDistanceMeters(lat!, lng!, e.latitude, e.longitude) /
                1000) *
                10
            ) / 10
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
        joinUrl: e.shareSlug ? `${baseUrl}/g/${e.shareSlug}` : null,
        source: "EVENT",
        photographerName: null,
      });
    }

    const albumWhere: Record<string, unknown> = {
      ...publicAlbumFilter(),
      deletedAt: null,
      isTest: false,
    };
    if (!includeEventSubalbums) {
      albumWhere.eventId = null;
    }
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
        eventId: true,
        coverThumbnailKey: true,
        coverPhoto: { select: { originalKey: true, previewUrl: true } },
        photos: {
          where: { isRemoved: false },
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { originalKey: true, previewUrl: true },
        },
        user: { select: { name: true, companyName: true } },
        _count: { select: { photos: { where: { isRemoved: false } } } },
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    for (const a of albums) {
      if (a._count.photos === 0) continue;

      const distanceKm =
        hasLocation && a.latitude != null && a.longitude != null
          ? Math.round(
              (haversineDistanceMeters(lat!, lng!, a.latitude, a.longitude) /
                1000) *
                10
            ) / 10
          : null;
      const startsAt = a.startsAt ?? a.eventDate;
      let coverUrl: string | null = null;
      if (a.coverThumbnailKey) coverUrl = getR2PublicUrl(a.coverThumbnailKey);
      else if (a.coverPhoto) {
        coverUrl = coverPhotoPublicUrl(
          a.coverPhoto as { originalKey?: string; previewUrl?: string }
        );
      } else if (a.photos?.[0]) {
        coverUrl = coverPhotoPublicUrl(
          a.photos[0] as { originalKey?: string; previewUrl?: string }
        );
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
        photographerName: a.user?.companyName || a.user?.name || null,
      });
    }

    if (hasLocation) {
      const withDistance = result.filter(
        (e) => e.distanceKm != null && e.distanceKm <= RADIUS_KM
      );
      const withoutDistance = result.filter((e) => e.distanceKm == null);
      withDistance.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      return NextResponse.json({
        events: [...withDistance, ...withoutDistance],
        radiusKm: RADIUS_KM,
        hasLocation,
      });
    }

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
      { error: "Error listando eventos" },
      { status: 500 }
    );
  }
}
