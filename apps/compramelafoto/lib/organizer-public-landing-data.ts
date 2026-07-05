import {
  EventMemberRole,
  EventMemberStatus,
  EventStatus,
  EventVisibility,
  Prisma,
  Role,
} from "@prisma/client";
import { isAlbumPubliclyAccessible, publicAlbumFilter } from "@/lib/album-helpers";
import { getR2PublicUrl } from "@/lib/r2-public-url";
import { buildAlbumListCoverUrls } from "@/lib/album/album-list-cover";
import { buildPhotoViewApiUrl } from "@/lib/images/public-photo-view-url";
import { prisma } from "@/lib/prisma";
import {
  getPublicSiteOrigin,
  publicAlbumPath,
  publicEventGalleryPath,
  publicEventJoinPath,
  publicPhotographerProfilePath,
} from "@/lib/public-site-url";
import {
  sortFeaturedGalleriesForPublicPage,
  sortPastEventsForPublicPage,
  sortUpcomingEventsForPublicPage,
} from "@/lib/organizer-public-landing-list";

export type OrganizerPublicSponsor = {
  id: number;
  name: string;
  url: string | null;
  logoUrl: string;
};

export type OrganizerPublicLandingEvent = {
  id: number;
  title: string;
  city: string;
  locationName: string | null;
  zone: string | null;
  startsAt: string;
  shareSlug: string;
  coverUrl: string | null;
  joinUrl: string;
  galleryUrl: string | null;
  confirmedPhotographersCount: number;
  photographerLabel: string | null;
  isPast: boolean;
};

export type OrganizerPublicFeaturedGallery = {
  id: number;
  sortOrder: number;
  title: string;
  subtitle: string | null;
  city: string | null;
  coverUrl: string | null;
  coverUrlFallback: string | null;
  photosCount: number;
  isComingSoon: boolean;
  startsAt: string | null;
  photographerLabel: string | null;
  galleryUrl: string | null;
  eventUrl: string | null;
  kind: "album" | "event";
};

type EventGalleryCoverMeta = {
  photosCount: number;
  firstPhoto: { id: number; albumId: number } | null;
};

async function loadEventGalleryCoverMeta(
  eventIds: number[]
): Promise<Map<number, EventGalleryCoverMeta>> {
  const result = new Map<number, EventGalleryCoverMeta>();
  if (eventIds.length === 0) return result;

  for (const id of eventIds) {
    result.set(id, { photosCount: 0, firstPhoto: null });
  }

  const albums = await prisma.album.findMany({
    where: {
      eventId: { in: eventIds },
      deletedAt: null,
      ...publicAlbumFilter(),
    },
    select: { id: true, eventId: true },
  });

  if (albums.length === 0) return result;

  const albumToEvent = new Map(albums.map((a) => [a.id, a.eventId]));
  const albumIds = albums.map((a) => a.id);

  const photoRows = await prisma.photo.findMany({
    where: {
      isRemoved: false,
      albumId: { in: albumIds },
    },
    orderBy: [{ capturedAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, albumId: true },
  });

  for (const photo of photoRows) {
    const eventId = albumToEvent.get(photo.albumId);
    if (eventId == null) continue;
    const meta = result.get(eventId)!;
    meta.photosCount += 1;
    if (!meta.firstPhoto) {
      meta.firstPhoto = { id: photo.id, albumId: photo.albumId };
    }
  }

  return result;
}

function resolveEventFeaturedCoverUrls(
  coverImageKey: string | null,
  meta: EventGalleryCoverMeta
): { coverUrl: string | null; coverUrlFallback: string | null } {
  const fromKey = r2PublicUrl(coverImageKey);
  const fromPhoto = meta.firstPhoto
    ? buildPhotoViewApiUrl(meta.firstPhoto.id, meta.firstPhoto.albumId, "cover")
    : null;

  if (fromKey && fromPhoto && fromKey !== fromPhoto) {
    return { coverUrl: fromKey, coverUrlFallback: fromPhoto };
  }
  if (fromKey) {
    return { coverUrl: fromKey, coverUrlFallback: null };
  }
  if (fromPhoto) {
    return { coverUrl: fromPhoto, coverUrlFallback: null };
  }
  return { coverUrl: null, coverUrlFallback: null };
}

export type OrganizerPublicPhotographerCard = {
  userId: number;
  name: string;
  city: string | null;
  logoUrl: string | null;
  profileUrl: string | null;
  eventsWithOrganizer: number;
};

/** @deprecated Solo compatibilidad; la landing pública ya no usa comunidad amplia. */
export type OrganizerPublicCommunity = {
  featured: OrganizerPublicPhotographerCard[];
  workedWithUs: OrganizerPublicPhotographerCard[];
  nearby: OrganizerPublicPhotographerCard[];
};

export type OrganizerPublicPhotographersLanding = {
  official: OrganizerPublicPhotographerCard[];
  frequent: OrganizerPublicPhotographerCard[];
};

/** @deprecated Preferir rutas relativas en UI; usar getPublicSiteOrigin() para URLs absolutas. */
function siteBaseUrl(): string {
  return getPublicSiteOrigin();
}

export function r2PublicUrl(key: string | null | undefined): string | null {
  if (!key?.trim()) return null;
  return getR2PublicUrl(key.replace(/^\//, ""));
}

function normalizeLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return logoUrl;
  }
  return r2PublicUrl(logoUrl);
}

function photographerLabelFromMembers(
  members: Array<{ user: { name: string | null; companyName: string | null; email: string | null } }>
): string | null {
  const names = members
    .map((m) => m.user.companyName?.trim() || m.user.name?.trim() || m.user.email?.split("@")[0])
    .filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : null;
}

function mapEventRow(
  e: {
    id: number;
    title: string;
    city: string;
    locationName: string | null;
    startsAt: Date;
    shareSlug: string | null;
    coverImageKey: string | null;
    _count?: { members: number };
    members?: Array<{ user: { name: string | null; companyName: string | null; email: string | null } }>;
  },
  isPast: boolean
): OrganizerPublicLandingEvent | null {
  if (!e.shareSlug) return null;
  return {
    id: e.id,
    title: e.title,
    city: e.city,
    locationName: e.locationName,
    zone: null,
    startsAt: e.startsAt.toISOString(),
    shareSlug: e.shareSlug,
    coverUrl: r2PublicUrl(e.coverImageKey),
    joinUrl: publicEventJoinPath(e.shareSlug),
    galleryUrl: publicEventGalleryPath(e.shareSlug),
    confirmedPhotographersCount: e._count?.members ?? 0,
    photographerLabel: e.members ? photographerLabelFromMembers(e.members) : null,
    isPast,
  };
}

const publicEventWhere = (organizerUserId: number): Prisma.EventWhereInput => ({
  creatorId: organizerUserId,
  archivedAt: null,
  visibility: EventVisibility.PUBLIC,
  status: EventStatus.ACTIVE,
  shareSlug: { not: null },
});

/**
 * Eventos públicos próximos del organizador (máx. 12).
 */
export async function getOrganizerUpcomingEvents(
  organizerUserId: number,
  take = 12
): Promise<OrganizerPublicLandingEvent[]> {
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: {
      ...publicEventWhere(organizerUserId),
      OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }],
    },
    select: {
      id: true,
      title: true,
      city: true,
      locationName: true,
      startsAt: true,
      shareSlug: true,
      coverImageKey: true,
      _count: {
        select: {
          members: {
            where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
          },
        },
      },
      members: {
        where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
        select: {
          user: { select: { name: true, companyName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 8,
      },
    },
    orderBy: { startsAt: "asc" },
    take,
  });

  return sortUpcomingEventsForPublicPage(
    rows
      .map((e) => mapEventRow(e, false))
      .filter((e): e is OrganizerPublicLandingEvent => e != null)
  );
}

/**
 * Eventos públicos ya realizados (máx. 12).
 */
export async function getOrganizerPastEvents(
  organizerUserId: number,
  take = 12
): Promise<OrganizerPublicLandingEvent[]> {
  const now = new Date();
  const rows = await prisma.event.findMany({
    where: {
      ...publicEventWhere(organizerUserId),
      startsAt: { lt: now },
    },
    select: {
      id: true,
      title: true,
      city: true,
      locationName: true,
      startsAt: true,
      shareSlug: true,
      coverImageKey: true,
      _count: {
        select: {
          members: {
            where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
          },
        },
      },
      members: {
        where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
        select: {
          user: { select: { name: true, companyName: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 8,
      },
    },
    orderBy: { startsAt: "desc" },
    take,
  });

  return sortPastEventsForPublicPage(
    rows
      .map((e) => mapEventRow(e, true))
      .filter((e): e is OrganizerPublicLandingEvent => e != null)
  );
}

function resolveAlbumFeaturedCoverUrls(album: {
  id: number;
  coverPhotoId?: number | null;
  coverThumbnailKey: string | null;
  coverPhoto: { id: number; originalKey: string | null; previewUrl: string | null } | null;
  photos?: { id: number; originalKey: string | null; previewUrl: string | null; isRemoved?: boolean | null }[];
}): { coverUrl: string | null; coverUrlFallback: string | null } {
  const { coverPhotoUrl, coverPhotoUrlFallback } = buildAlbumListCoverUrls({
    id: album.id,
    coverPhotoId: album.coverPhotoId ?? null,
    coverThumbnailKey: album.coverThumbnailKey,
    coverPhoto: album.coverPhoto,
    photos: album.photos,
  });
  return { coverUrl: coverPhotoUrl, coverUrlFallback: coverPhotoUrlFallback };
}

/**
 * Galerías destacadas activas y públicas.
 */
export async function getOrganizerFeaturedGalleries(
  profileId: number,
  organizerUserId: number
): Promise<OrganizerPublicFeaturedGallery[]> {
  const rows = await prisma.organizerFeaturedGallery.findMany({
    where: { profileId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sortOrder: true,
      albumId: true,
      eventId: true,
      album: {
        select: {
          id: true,
          title: true,
          publicSlug: true,
          city: true,
          eventDate: true,
          startsAt: true,
          isPublic: true,
          isHidden: true,
          deletedAt: true,
          coverPhotoId: true,
          coverThumbnailKey: true,
          coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
          photos: {
            where: { isRemoved: false },
            select: { id: true, originalKey: true, previewUrl: true, isRemoved: true },
            orderBy: { createdAt: "asc" },
            take: 1,
          },
          _count: {
            select: {
              photos: { where: { isRemoved: false } },
            },
          },
          event: { select: { creatorId: true, title: true, startsAt: true } },
          user: { select: { name: true, companyName: true, email: true } },
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          city: true,
          startsAt: true,
          shareSlug: true,
          coverImageKey: true,
          creatorId: true,
          visibility: true,
          archivedAt: true,
          status: true,
          members: {
            where: { role: EventMemberRole.PHOTOGRAPHER, status: EventMemberStatus.ACTIVE },
            select: {
              user: { select: { name: true, companyName: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 8,
          },
        },
      },
    },
  });

  const eventIds = rows
    .map((row) => row.event?.id)
    .filter((id): id is number => id != null);
  const eventCoverMeta = await loadEventGalleryCoverMeta(eventIds);

  const result: OrganizerPublicFeaturedGallery[] = [];

  for (const row of rows) {
    if (row.eventId && row.event) {
      const ev = row.event;
      if (
        ev.creatorId !== organizerUserId ||
        ev.visibility !== EventVisibility.PUBLIC ||
        ev.archivedAt != null ||
        ev.status !== EventStatus.ACTIVE ||
        !ev.shareSlug
      ) {
        continue;
      }
      const meta = eventCoverMeta.get(ev.id) ?? { photosCount: 0, firstPhoto: null };
      const { coverUrl, coverUrlFallback } = resolveEventFeaturedCoverUrls(ev.coverImageKey, meta);
      const photosCount = meta.photosCount;
      result.push({
        id: row.id,
        sortOrder: row.sortOrder,
        title: ev.title,
        subtitle: ev.city,
        city: ev.city,
        coverUrl,
        coverUrlFallback,
        photosCount,
        isComingSoon: photosCount <= 0,
        startsAt: ev.startsAt.toISOString(),
        photographerLabel: photographerLabelFromMembers(ev.members ?? []),
        galleryUrl: publicEventGalleryPath(ev.shareSlug),
        eventUrl: publicEventJoinPath(ev.shareSlug),
        kind: "event",
      });
      continue;
    }

    if (row.albumId && row.album) {
      const alb = row.album;
      if (alb.deletedAt || !isAlbumPubliclyAccessible(alb)) continue;
      if (!alb.event || alb.event.creatorId !== organizerUserId) continue;

      const photosCount = alb._count?.photos ?? 0;
      const { coverUrl, coverUrlFallback } = resolveAlbumFeaturedCoverUrls(alb);
      const albumStartsAt =
        alb.event?.startsAt ?? alb.eventDate ?? alb.startsAt ?? null;
      const photographerLabel = alb.user
        ? photographerLabelFromMembers([{ user: alb.user }])
        : null;

      result.push({
        id: row.id,
        sortOrder: row.sortOrder,
        title: alb.title,
        subtitle: alb.city || alb.event?.title || null,
        city: alb.city ?? null,
        coverUrl,
        coverUrlFallback,
        photosCount,
        isComingSoon: photosCount <= 0,
        startsAt: albumStartsAt ? albumStartsAt.toISOString() : null,
        photographerLabel,
        galleryUrl: publicAlbumPath(alb.publicSlug),
        eventUrl: null,
        kind: "album",
      });
    }
  }

  return sortFeaturedGalleriesForPublicPage(result);
}

export type PhotographerAgg = {
  userId: number;
  name: string;
  city: string | null;
  province: string | null;
  logoUrl: string | null;
  publicPageHandler: string | null;
  latitude: number | null;
  longitude: number | null;
  eventCount: number;
};

export async function loadOrganizerPhotographerAggs(organizerUserId: number): Promise<PhotographerAgg[]> {
  const eventIds = await prisma.event.findMany({
    where: { creatorId: organizerUserId, archivedAt: null },
    select: { id: true },
  });
  const ids = eventIds.map((e) => e.id);
  if (ids.length === 0) return [];

  const members = await prisma.eventMember.findMany({
    where: {
      eventId: { in: ids },
      role: EventMemberRole.PHOTOGRAPHER,
      status: EventMemberStatus.ACTIVE,
      user: {
        isBlocked: false,
        role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
      },
    },
    select: {
      eventId: true,
      user: {
        select: {
          id: true,
          name: true,
          companyName: true,
          city: true,
          province: true,
          logoUrl: true,
          publicPageHandler: true,
          isPublicPageEnabled: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  const eventIdsByUser = new Map<number, Set<number>>();
  const userById = new Map<number, (typeof members)[0]["user"]>();

  for (const m of members) {
    userById.set(m.user.id, m.user);
    const set = eventIdsByUser.get(m.user.id) ?? new Set<number>();
    set.add(m.eventId);
    eventIdsByUser.set(m.user.id, set);
  }

  const aggs: PhotographerAgg[] = [];
  for (const [userId, eventSet] of eventIdsByUser) {
    const u = userById.get(userId);
    if (!u) continue;
    aggs.push({
      userId: u.id,
      name: (u.companyName || u.name || "Fotógrafo").trim(),
      city: u.city,
      province: u.province,
      logoUrl: normalizeLogoUrl(u.logoUrl),
      publicPageHandler: u.isPublicPageEnabled ? u.publicPageHandler : null,
      latitude: u.latitude,
      longitude: u.longitude,
      eventCount: eventSet.size,
    });
  }

  return aggs.sort((a, b) => b.eventCount - a.eventCount);
}

function toPhotographerCard(p: PhotographerAgg): OrganizerPublicPhotographerCard {
  return {
    userId: p.userId,
    name: p.name,
    city: [p.city, p.province].filter(Boolean).join(" · ") || null,
    logoUrl: p.logoUrl,
    profileUrl: p.publicPageHandler ? publicPhotographerProfilePath(p.publicPageHandler) : null,
    eventsWithOrganizer: p.eventCount,
  };
}

/**
 * Fotógrafos reales para la landing pública: oficiales (participación verificada) y frecuentes (2+ eventos).
 * No incluye fotógrafos de la plataforma sin relación con el organizador.
 */
export async function getOrganizerPublicPhotographers(
  organizerUserId: number
): Promise<OrganizerPublicPhotographersLanding> {
  const aggs = (await loadOrganizerPhotographerAggs(organizerUserId)).filter((p) => p.publicPageHandler);

  const frequentAggs = aggs.filter((p) => p.eventCount >= 2).slice(0, 8);
  const frequent = frequentAggs.map((p) => toPhotographerCard(p));
  const frequentIds = new Set(frequent.map((p) => p.userId));

  let officialAggs: PhotographerAgg[];
  const soloEvent = aggs.filter((p) => p.eventCount === 1);
  if (frequent.length > 0 && soloEvent.length > 0) {
    officialAggs = soloEvent;
  } else if (frequent.length > 0) {
    officialAggs = aggs.filter((p) => !frequentIds.has(p.userId));
  } else {
    officialAggs = aggs;
  }

  const official = officialAggs.slice(0, 12).map((p) => toPhotographerCard(p));

  return { official, frequent };
}

/** @deprecated Usar getOrganizerPublicPhotographers().official */
export async function getOrganizerOfficialPhotographers(
  organizerUserId: number
): Promise<OrganizerPublicPhotographerCard[]> {
  const { official } = await getOrganizerPublicPhotographers(organizerUserId);
  return official;
}

/**
 * Fotógrafos oficiales configurados manualmente en el panel del organizador.
 * Si hay al menos uno activo, reemplaza el listado automático en la landing pública.
 */
export async function getOrganizerManualOfficialPhotographers(
  profileId: number,
  organizerUserId: number
): Promise<OrganizerPublicPhotographerCard[]> {
  const rows = await prisma.organizerOfficialPhotographer.findMany({
    where: { profileId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      photographer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          city: true,
          province: true,
          logoUrl: true,
          publicPageHandler: true,
          isPublicPageEnabled: true,
        },
      },
    },
  });

  if (rows.length === 0) return [];

  const eventCounts = new Map(
    (await loadOrganizerPhotographerAggs(organizerUserId)).map((a) => [a.userId, a.eventCount])
  );

  return rows.map((row) => {
    const u = row.photographer;
    const handler = u.isPublicPageEnabled ? u.publicPageHandler : null;
    return {
      userId: u.id,
      name: (u.companyName || u.name || "Fotógrafo").trim(),
      city: [u.city, u.province].filter(Boolean).join(" · ") || null,
      logoUrl: normalizeLogoUrl(u.logoUrl),
      profileUrl: handler ? publicPhotographerProfilePath(handler) : null,
      eventsWithOrganizer: eventCounts.get(u.id) ?? 0,
    };
  });
}

export async function resolveOrganizerOfficialPhotographersForPublic(
  profileId: number,
  organizerUserId: number
): Promise<OrganizerPublicPhotographerCard[]> {
  const manual = await getOrganizerManualOfficialPhotographers(profileId, organizerUserId);
  if (manual.length > 0) return manual;
  const { official } = await getOrganizerPublicPhotographers(organizerUserId);
  return official;
}

/** @deprecated Eliminado de la landing pública; ver getOrganizerPrivateCommunityDiscovery. */
export async function getOrganizerCommunityPhotographers(
  _organizerUserId: number,
  _organizerCity: string | null,
  _organizerZone: string | null
): Promise<OrganizerPublicCommunity> {
  return { featured: [], workedWithUs: [], nearby: [] };
}

/** Primer evento próximo para CTA de convocatoria. */
export async function getOrganizerPrimaryUpcomingEventSlug(
  organizerUserId: number
): Promise<string | null> {
  const upcoming = await getOrganizerUpcomingEvents(organizerUserId, 1);
  return upcoming[0]?.shareSlug ?? null;
}

/** Búsqueda de álbumes/eventos del organizador para el panel (destacados). */
export async function searchOrganizerFeaturedCandidates(
  organizerUserId: number,
  profileId: number,
  query: string
) {
  const q = query.trim();
  const featured = await prisma.organizerFeaturedGallery.findMany({
    where: { profileId },
    select: { albumId: true, eventId: true },
  });
  const featuredAlbumIds = new Set(
    featured.map((f: { albumId: number | null }) => f.albumId).filter(Boolean) as number[]
  );
  const featuredEventIds = new Set(
    featured.map((f: { eventId: number | null }) => f.eventId).filter(Boolean) as number[]
  );

  const eventWhere: Prisma.EventWhereInput = {
    creatorId: organizerUserId,
    archivedAt: null,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const events = await prisma.event.findMany({
    where: eventWhere,
    orderBy: { startsAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      city: true,
      startsAt: true,
      shareSlug: true,
      coverImageKey: true,
      visibility: true,
    },
  });

  const albums = await prisma.album.findMany({
    where: {
      deletedAt: null,
      ...publicAlbumFilter(),
      event: { creatorId: organizerUserId },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      city: true,
      publicSlug: true,
      coverPhotoId: true,
      coverThumbnailKey: true,
      coverPhoto: { select: { id: true, originalKey: true, previewUrl: true } },
      photos: {
        where: { isRemoved: false },
        select: { id: true, originalKey: true, previewUrl: true, isRemoved: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      event: { select: { title: true } },
    },
  });

  return {
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      city: e.city,
      startsAt: e.startsAt.toISOString(),
      coverUrl: r2PublicUrl(e.coverImageKey),
      isPublic: e.visibility === EventVisibility.PUBLIC && Boolean(e.shareSlug),
      joinUrl: e.shareSlug ? publicEventJoinPath(e.shareSlug) : null,
      alreadyFeatured: featuredEventIds.has(e.id),
    })),
    albums: albums.map((a) => ({
      id: a.id,
      title: a.title,
      city: a.city,
      eventTitle: a.event?.title ?? null,
      coverUrl: buildAlbumListCoverUrls({
        id: a.id,
        coverPhotoId: a.coverPhotoId ?? null,
        coverThumbnailKey: a.coverThumbnailKey,
        coverPhoto: a.coverPhoto,
        photos: a.photos,
      }).coverPhotoUrl,
      albumUrl: publicAlbumPath(a.publicSlug),
      alreadyFeatured: featuredAlbumIds.has(a.id),
    })),
  };
}
