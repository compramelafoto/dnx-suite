import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import { distanceKm, resolveEventCoords } from "@/lib/geo";
import { slugifyTitle } from "@/lib/slug";
import { buildPublicEventLocation } from "@/lib/geolocation/public-location";
import type { LocationVisibility } from "@/lib/geolocation/types";

export type PublicEventCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  startAt: Date;
  endAt: Date | null;
  venueName: string | null;
  city: string;
  province: string;
  coverImageUrl: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  registrationUrl: string | null;
  distanceKm?: number | null;
};

const publicSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  startAt: true,
  endAt: true,
  venueName: true,
  city: true,
  province: true,
  coverImageUrl: true,
  registrationUrl: true,
  latitude: true,
  longitude: true,
  category: { select: { name: true, slug: true } },
} as const;

function toCard(
  row: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    startAt: Date;
    endAt: Date | null;
    venueName: string | null;
    city: string;
    province: string;
    coverImageUrl: string | null;
    registrationUrl: string | null;
    latitude?: number | null;
    longitude?: number | null;
    category: { name: string; slug: string } | null;
  },
  distance?: number | null,
): PublicEventCard {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    startAt: row.startAt,
    endAt: row.endAt,
    venueName: row.venueName,
    city: row.city,
    province: row.province,
    coverImageUrl: row.coverImageUrl,
    registrationUrl: row.registrationUrl,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    distanceKm: distance ?? null,
  };
}

type GeoFilter = { lat: number; lng: number; radiusKm: number };

function filterByGeo<
  T extends {
    latitude: number | null;
    longitude: number | null;
    city: string;
    province: string;
  },
>(rows: T[], geo: GeoFilter): Array<T & { _distanceKm: number }> {
  const out: Array<T & { _distanceKm: number }> = [];
  for (const row of rows) {
    const coords = resolveEventCoords(row);
    if (!coords) continue;
    const d = distanceKm(geo.lat, geo.lng, coords.lat, coords.lng);
    if (d <= geo.radiusKm) out.push({ ...row, _distanceKm: d });
  }
  out.sort((a, b) => a._distanceKm - b._distanceKm);
  return out;
}

export async function ensureUniqueEventSlug(
  base: string,
  excludeId?: string,
): Promise<string> {
  const slug = slugifyTitle(base) || "evento";
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await prisma.infoSpotEvent.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return candidate;
    n += 1;
    if (n > 50) return `${slug}-${Date.now()}`;
  }
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.INFOSPOT_IP_HASH_SALT || "infospot-events-mvp";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Rate limit: máx. N envíos por IP hash en ventana. */
export async function tooManyRecentSubmissions(
  ipHash: string | null,
  limit = 5,
  windowMs = 60 * 60 * 1000,
): Promise<boolean> {
  if (!ipHash) return false;
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.infoSpotEventSubmission.count({
    where: { ipHash, createdAt: { gte: since } },
  });
  return count >= limit;
}

/** Solo eventos PUBLISHED en superficies públicas (ETAPA 15: sin filtro contentTag). */
const publicEventWhere = {
  status: "PUBLISHED" as const,
};

export async function getPublishedEvents(options?: {
  take?: number;
  upcomingOnly?: boolean;
  categorySlug?: string;
  province?: string;
}): Promise<PublicEventCard[]> {
  const now = new Date();
  const take = options?.take ?? 24;
  const rows = await prisma.infoSpotEvent.findMany({
    where: {
      ...publicEventWhere,
      ...(options?.upcomingOnly ? { startAt: { gte: now } } : {}),
      ...(options?.categorySlug
        ? { category: { slug: options.categorySlug } }
        : {}),
      ...(options?.province
        ? { province: { equals: options.province, mode: "insensitive" as const } }
        : {}),
    },
    orderBy: { startAt: "asc" },
    take,
    select: publicSelect,
  });
  return rows.map(toCard);
}

export async function getPublishedEventsSplit(options?: {
  takeUpcoming?: number;
  takePast?: number;
  categorySlug?: string;
  province?: string;
  near?: GeoFilter | null;
}) {
  const now = new Date();
  const baseWhere = {
    ...publicEventWhere,
    ...(options?.categorySlug
      ? { category: { slug: options.categorySlug } }
      : {}),
    ...(options?.province
      ? { province: { equals: options.province, mode: "insensitive" as const } }
      : {}),
  };

  // Con filtro geo pedimos más filas y filtramos en memoria (lat/lng o centroide ciudad).
  const takeUpcoming = options?.near
    ? Math.max(options.takeUpcoming ?? 24, 80)
    : (options?.takeUpcoming ?? 24);
  const takePast = options?.near
    ? Math.max(options.takePast ?? 12, 40)
    : (options?.takePast ?? 12);

  const [upcomingRows, pastRows] = await Promise.all([
    takeUpcoming === 0
      ? Promise.resolve([])
      : prisma.infoSpotEvent.findMany({
          where: { ...baseWhere, startAt: { gte: now } },
          orderBy: { startAt: "asc" },
          take: takeUpcoming,
          select: publicSelect,
        }),
    takePast === 0
      ? Promise.resolve([])
      : prisma.infoSpotEvent.findMany({
          where: { ...baseWhere, startAt: { lt: now } },
          orderBy: { startAt: "desc" },
          take: takePast,
          select: publicSelect,
        }),
  ]);

  if (!options?.near) {
    return {
      upcoming: upcomingRows.map((r) => toCard(r)),
      past: pastRows.map((r) => toCard(r)),
    };
  }

  const near = options.near;
  const upcomingFiltered = filterByGeo(upcomingRows, near).slice(
    0,
    options.takeUpcoming ?? 24,
  );
  const pastFiltered = filterByGeo(pastRows, near).slice(0, options.takePast ?? 12);

  return {
    upcoming: upcomingFiltered.map((r) => toCard(r, r._distanceKm)),
    past: pastFiltered.map((r) => toCard(r, r._distanceKm)),
  };
}

/** Home / destacados: solo próximos REAL (nunca rellenar con pasados). */
export async function getFeaturedPublishedEvents(limit = 4): Promise<PublicEventCard[]> {
  const now = new Date();
  const upcoming = await prisma.infoSpotEvent.findMany({
    where: { ...publicEventWhere, startAt: { gte: now } },
    orderBy: { startAt: "asc" },
    take: limit,
    select: publicSelect,
  });
  return upcoming.map(toCard);
}

export async function getPublishedEventBySlug(slug: string) {
  return prisma.infoSpotEvent.findFirst({
    where: { slug, ...publicEventWhere },
    include: {
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function getEventProvinces(): Promise<string[]> {
  const rows = await prisma.infoSpotEvent.findMany({
    where: publicEventWhere,
    select: { province: true },
    distinct: ["province"],
    orderBy: { province: "asc" },
  });
  return rows.map((r) => r.province).filter(Boolean);
}

/** Vista pública segura: sin email/teléfono; ubicación filtrada por visibility. */
export function toPublicEventDetail(event: {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string;
  startAt: Date;
  endAt: Date | null;
  venueName: string | null;
  city: string;
  province: string;
  address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVisibility?: LocationVisibility | null;
  coverImageUrl: string | null;
  registrationUrl: string | null;
  sourceUrl: string | null;
  organizerName: string;
  organizerWebsite: string | null;
  category: { name: string; slug: string } | null;
}) {
  const publicLocation = buildPublicEventLocation({
    city: event.city,
    province: event.province,
    venueName: event.venueName,
    address: event.address,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    locationVisibility: event.locationVisibility ?? "CITY_ONLY",
  });

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    summary: event.summary,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    /** Preferir publicLocation en UI; estos campos ya están filtrados. */
    venueName: publicLocation.venueName,
    city: publicLocation.city ?? "",
    province: publicLocation.province ?? "",
    address: publicLocation.address,
    publicLocation,
    coverImageUrl: event.coverImageUrl,
    registrationUrl: event.registrationUrl,
    sourceUrl: event.sourceUrl,
    organizerName: event.organizerName,
    organizerWebsite: event.organizerWebsite,
    categoryName: event.category?.name ?? null,
    categorySlug: event.category?.slug ?? null,
  };
}
