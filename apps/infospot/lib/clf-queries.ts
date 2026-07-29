import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import { getClfReadonlyClient } from "@/lib/clf-readonly-db";
import { buildClfThumbApiPath } from "@/lib/editorial-photo-previews";

const clfEventListSelect = {
  id: true,
  title: true,
  startsAt: true,
  endsAt: true,
  city: true,
  locationName: true,
  latitude: true,
  longitude: true,
  status: true,
  visibility: true,
  creator: { select: { id: true, name: true, email: true } },
  _count: { select: { albums: { where: { deletedAt: null } } } },
} as const;

export type ClfEventListRow = {
  id: number;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  city: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  visibility: string;
  organizerName: string;
  albumCount: number;
};

function mapClfEventRow(e: {
  id: number;
  title: string;
  startsAt: Date | null;
  endsAt: Date | null;
  city: string | null;
  locationName: string | null;
  latitude: number;
  longitude: number;
  status: string;
  visibility: string;
  creator: { id: number; name: string | null; email: string };
  _count: { albums: number };
}): ClfEventListRow {
  return {
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    city: e.city,
    locationName: e.locationName,
    latitude: e.latitude,
    longitude: e.longitude,
    status: e.status,
    visibility: e.visibility,
    organizerName: e.creator.name?.trim() || e.creator.email,
    albumCount: e._count.albums,
  };
}

function clfSearchWhere(q: string) {
  const tokens = q
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  const terms = tokens.length > 0 ? tokens : [q.trim()];

  // Cada token debe aparecer en al menos un campo (AND de ORs).
  return {
    archivedAt: null as null,
    AND: terms.map((term) => ({
      OR: [
        { title: { contains: term, mode: "insensitive" as const } },
        { city: { contains: term, mode: "insensitive" as const } },
        { locationName: { contains: term, mode: "insensitive" as const } },
        { creator: { name: { contains: term, mode: "insensitive" as const } } },
        { creator: { email: { contains: term, mode: "insensitive" as const } } },
      ],
    })),
  };
}

export async function searchClfEvents(query: string, take = 40) {
  const q = query.trim();
  if (q.length < 2) return [];

  const clf = getClfReadonlyClient();
  const events = await clf.event.findMany({
    where: clfSearchWhere(q),
    select: clfEventListSelect,
    orderBy: { startsAt: "desc" },
    take,
  });

  return events.map(mapClfEventRow);
}

/**
 * Ciudades distintas de eventos CLF activos (para filtros del asistente).
 * No depende del subset en memoria.
 */
export async function listClfCitiesForAssistant(take = 200): Promise<string[]> {
  const clf = getClfReadonlyClient();
  const rows = await clf.event.findMany({
    where: { archivedAt: null, city: { not: "" } },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
    take,
  });
  return rows
    .map((r) => r.city?.trim())
    .filter((c): c is string => Boolean(c))
    .sort((a, b) => a.localeCompare(b, "es"));
}

/**
 * Listado para el Asistente Editorial (sin exigir búsqueda).
 * Solo lectura CLF; no modifica sync ni provisioning.
 */
export async function listClfEventsForAssistant(options?: {
  take?: number;
  window?: "upcoming" | "recent" | "all";
  city?: string;
}) {
  const take = options?.take ?? 80;
  const window = options?.window ?? "all";
  const now = new Date();
  const clf = getClfReadonlyClient();
  const city = options?.city?.trim();

  const where: {
    archivedAt: null;
    startsAt?: { gte?: Date; lte?: Date };
    city?: { equals: string; mode: "insensitive" };
  } = { archivedAt: null };

  if (window === "upcoming") {
    where.startsAt = { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) };
  } else if (window === "recent") {
    where.startsAt = { lte: now };
  }
  if (city) {
    where.city = { equals: city, mode: "insensitive" };
  }

  const events = await clf.event.findMany({
    where,
    select: clfEventListSelect,
    orderBy: { startsAt: window === "upcoming" ? "asc" : "desc" },
    take,
  });

  return events.map(mapClfEventRow);
}

/** Enriquece cards del asistente con fechas reales de CLF. */
export async function hydrateAssistantEventsWithClfDates(
  eventIds: number[],
): Promise<
  Map<
    number,
    {
      startsAt: Date | null;
      endsAt: Date | null;
      city: string | null;
      title: string;
      albumCount: number;
      latitude: number | null;
      longitude: number | null;
    }
  >
> {
  const ids = [...new Set(eventIds.filter((id) => Number.isFinite(id) && id > 0))];
  const map = new Map<
    number,
    {
      startsAt: Date | null;
      endsAt: Date | null;
      city: string | null;
      title: string;
      albumCount: number;
      latitude: number | null;
      longitude: number | null;
    }
  >();
  if (ids.length === 0) return map;

  try {
    const clf = getClfReadonlyClient();
    const rows = await clf.event.findMany({
      where: { id: { in: ids }, archivedAt: null },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        city: true,
        latitude: true,
        longitude: true,
        _count: { select: { albums: { where: { deletedAt: null } } } },
      },
    });
    for (const row of rows) {
      map.set(row.id, {
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        city: row.city,
        title: row.title,
        albumCount: row._count.albums,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  } catch {
    // Si CLF no está disponible, el asistente sigue con datos de coberturas.
  }
  return map;
}

export async function getClfEventSummary(eventId: number) {
  const clf = getClfReadonlyClient();
  return clf.event.findFirst({
    where: { id: eventId, archivedAt: null },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      locationName: true,
      status: true,
      creator: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function listClfAlbumsForEvent(eventId: number) {
  const clf = getClfReadonlyClient();
  const albums = await clf.album.findMany({
    where: { eventId, deletedAt: null },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      isHidden: true,
      isPublic: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { photos: { where: { isRemoved: false, storageDeletedAt: null } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return albums.map((album) => {
    const availability = resolveClfAlbumCommercialAvailability({
      publicSlug: album.publicSlug,
      isHidden: album.isHidden,
      isPublic: album.isPublic,
      deletedAt: album.deletedAt,
      firstPhotoDate: album.firstPhotoDate,
      createdAt: album.createdAt,
      expirationExtensionDays: album.expirationExtensionDays,
      cleanupStatus: album.cleanupStatus,
    });
    return {
      id: album.id,
      title: album.title,
      publicSlug: album.publicSlug,
      photographerName: album.user.name?.trim() || album.user.email,
      photographerId: album.user.id,
      photoCount: album._count.photos,
      availability,
    };
  });
}

export async function getClfAlbumDetail(albumId: number) {
  const clf = getClfReadonlyClient();
  const album = await clf.album.findFirst({
    where: { id: albumId, deletedAt: null },
    select: {
      id: true,
      title: true,
      publicSlug: true,
      eventId: true,
      isHidden: true,
      isPublic: true,
      deletedAt: true,
      firstPhotoDate: true,
      createdAt: true,
      expirationExtensionDays: true,
      cleanupStatus: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!album) return null;
  const availability = resolveClfAlbumCommercialAvailability({
    publicSlug: album.publicSlug,
    isHidden: album.isHidden,
    isPublic: album.isPublic,
    deletedAt: album.deletedAt,
    firstPhotoDate: album.firstPhotoDate,
    createdAt: album.createdAt,
    expirationExtensionDays: album.expirationExtensionDays,
    cleanupStatus: album.cleanupStatus,
  });
  return {
    ...album,
    photographerName: album.user.name?.trim() || album.user.email,
    photographerId: album.user.id,
    availability,
  };
}

export async function listClfPhotosForAlbum(albumId: number, photographerId?: number) {
  const clf = getClfReadonlyClient();
  const photos = await clf.photo.findMany({
    where: {
      albumId,
      isRemoved: false,
      storageDeletedAt: null,
      ...(photographerId ? { userId: photographerId } : {}),
    },
    select: {
      id: true,
      albumId: true,
      previewUrl: true,
      originalKey: true,
      thumbWatermarkedKey: true,
      previewWatermarkedKey: true,
      userId: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      album: {
        select: {
          id: true,
          title: true,
          publicSlug: true,
          eventId: true,
          event: { select: { id: true, title: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const photoIds = photos.map((p) => p.id);
  const existingAssets = photoIds.length
    ? await prisma.infoSpotEditorialAsset.findMany({
        where: { sourceType: "CLF_PHOTO", sourcePhotoId: { in: photoIds } },
        select: { id: true, sourcePhotoId: true },
      })
    : [];
  const assetByPhoto = new Map(
    existingAssets
      .filter((a) => a.sourcePhotoId != null)
      .map((a) => [a.sourcePhotoId as number, a.id]),
  );

  return photos.map((photo) => {
    const photographer = photo.uploadedBy ?? photo.album.user;
    return {
      id: photo.id,
      albumId: photo.albumId,
      albumTitle: photo.album.title,
      eventId: photo.album.eventId,
      eventTitle: photo.album.event?.title ?? null,
      photographerId: photographer.id,
      photographerName: photographer.name?.trim() || photographer.email,
      hasEditorialCopy: assetByPhoto.has(photo.id),
      editorialAssetId: assetByPhoto.get(photo.id) ?? null,
      thumbApiPath: buildClfThumbApiPath(photo.id, photo.albumId),
    };
  });
}
