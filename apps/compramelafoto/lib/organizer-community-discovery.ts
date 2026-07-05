import { Role } from "@prisma/client";
import { haversineDistanceMeters } from "@/lib/geo";
import { getR2PublicUrl } from "@/lib/r2-client";
import {
  loadOrganizerPhotographerAggs,
  type PhotographerAgg,
} from "@/lib/organizer-public-landing-data";
import { prisma } from "@/lib/prisma";
import { publicPhotographerProfilePath } from "@/lib/public-site-url";

export type OrganizerDiscoveryPhotographer = {
  userId: number;
  name: string;
  city: string | null;
  logoUrl: string | null;
  profileUrl: string | null;
  eventsWithOrganizer: number;
  distanceKm: number | null;
};

function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) return logoUrl;
  return getR2PublicUrl(logoUrl.replace(/^\//, ""));
}

function toDiscoveryCard(
  p: PhotographerAgg,
  distanceKm: number | null = null
): OrganizerDiscoveryPhotographer {
  return {
    userId: p.userId,
    name: p.name,
    city: [p.city, p.province].filter(Boolean).join(" · ") || null,
    logoUrl: p.logoUrl,
    profileUrl: p.publicPageHandler ? publicPhotographerProfilePath(p.publicPageHandler) : null,
    eventsWithOrganizer: p.eventCount,
    distanceKm,
  };
}

type PlatformPhotographer = {
  userId: number;
  name: string;
  city: string | null;
  province: string | null;
  logoUrl: string | null;
  publicPageHandler: string | null;
  latitude: number | null;
  longitude: number | null;
};

async function loadPlatformPhotographers(): Promise<PlatformPhotographer[]> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
      isPublicPageEnabled: true,
      isBlocked: false,
      publicPageHandler: { not: null },
    },
    select: {
      id: true,
      name: true,
      companyName: true,
      city: true,
      province: true,
      logoUrl: true,
      publicPageHandler: true,
      latitude: true,
      longitude: true,
    },
    take: 200,
  });

  return users.map((u) => ({
    userId: u.id,
    name: (u.companyName || u.name || "Fotógrafo").trim(),
    city: u.city,
    province: u.province,
    logoUrl: normalizeLogoUrl(u.logoUrl),
    publicPageHandler: u.publicPageHandler,
    latitude: u.latitude,
    longitude: u.longitude,
  }));
}

function platformToAgg(p: PlatformPhotographer): PhotographerAgg {
  return {
    userId: p.userId,
    name: p.name,
    city: p.city,
    province: p.province,
    logoUrl: p.logoUrl,
    publicPageHandler: p.publicPageHandler,
    latitude: p.latitude,
    longitude: p.longitude,
    eventCount: 0,
  };
}

export type OrganizerPrivateCommunityDiscovery = {
  workedWith: OrganizerDiscoveryPhotographer[];
  nearby: OrganizerDiscoveryPhotographer[];
  suggested: OrganizerDiscoveryPhotographer[];
  platformActive: OrganizerDiscoveryPhotographer[];
};

/**
 * Descubrimiento privado para el panel del organizador (no usar en landing pública).
 */
export async function getOrganizerPrivateCommunityDiscovery(
  organizerUserId: number,
  organizerCity: string | null,
  organizerZone: string | null
): Promise<OrganizerPrivateCommunityDiscovery> {
  const workedAggs = await loadOrganizerPhotographerAggs(organizerUserId);
  const workedIds = new Set(workedAggs.map((p) => p.userId));

  const workedWith = workedAggs
    .filter((p) => p.publicPageHandler)
    .slice(0, 24)
    .map((p) => toDiscoveryCard(p, null));

  const organizerUser = await prisma.user.findUnique({
    where: { id: organizerUserId },
    select: { latitude: true, longitude: true, city: true, province: true },
  });

  let refLat = organizerUser?.latitude ?? null;
  let refLng = organizerUser?.longitude ?? null;

  if (refLat == null || refLng == null) {
    const lastEvent = await prisma.event.findFirst({
      where: { creatorId: organizerUserId, archivedAt: null },
      orderBy: { startsAt: "desc" },
      select: { latitude: true, longitude: true },
    });
    refLat = lastEvent?.latitude ?? null;
    refLng = lastEvent?.longitude ?? null;
  }

  const cityNeedle = (organizerCity || organizerUser?.city || "").trim().toLowerCase();
  const zoneNeedle = (organizerZone || organizerUser?.province || "").trim().toLowerCase();

  const platform = await loadPlatformPhotographers();
  const discoveryPool = platform.filter((p) => !workedIds.has(p.userId));

  const withDistance = discoveryPool.map((p) => {
    let distanceKm: number | null = null;
    if (refLat != null && refLng != null && p.latitude != null && p.longitude != null) {
      distanceKm = haversineDistanceMeters(refLat, refLng, p.latitude, p.longitude) / 1000;
    }
    return { p, distanceKm };
  });

  const nearbySorted = [...withDistance].sort((a, b) => {
    const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.p.name.localeCompare(b.p.name, "es");
  });

  const nearby = nearbySorted.slice(0, 12).map(({ p, distanceKm }) =>
    toDiscoveryCard(platformToAgg(p), distanceKm != null ? Math.round(distanceKm * 10) / 10 : null)
  );

  const suggestedSorted = [...withDistance].sort((a, b) => {
    const score = (p: PlatformPhotographer) => {
      const c = (p.city || "").toLowerCase();
      const pr = (p.province || "").toLowerCase();
      if (cityNeedle && (c.includes(cityNeedle) || cityNeedle.includes(c))) return 0;
      if (zoneNeedle && (pr.includes(zoneNeedle) || zoneNeedle.includes(pr))) return 1;
      return 2;
    };
    const sa = score(a.p);
    const sb = score(b.p);
    if (sa !== sb) return sa - sb;
    return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
  });

  const nearbyIds = new Set(nearby.map((p) => p.userId));
  const suggested = suggestedSorted
    .filter(({ p }) => !nearbyIds.has(p.userId))
    .slice(0, 12)
    .map(({ p, distanceKm }) =>
      toDiscoveryCard(platformToAgg(p), distanceKm != null ? Math.round(distanceKm * 10) / 10 : null)
    );

  const usedIds = new Set([...nearbyIds, ...suggested.map((p) => p.userId)]);
  const platformActive = discoveryPool
    .filter((p) => !usedIds.has(p.userId))
    .slice(0, 24)
    .map((p) => toDiscoveryCard(platformToAgg(p), null));

  return { workedWith, nearby, suggested, platformActive };
}
