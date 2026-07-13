import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import { getClfReadonlyClient } from "@/lib/clf-readonly-db";
import { buildClfThumbApiPath } from "@/lib/editorial-photo-previews";

export async function searchClfEvents(query: string, take = 20) {
  const q = query.trim();
  if (q.length < 2) return [];

  const clf = getClfReadonlyClient();
  const events = await clf.event.findMany({
    where: {
      archivedAt: null,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { locationName: { contains: q, mode: "insensitive" } },
        { creator: { name: { contains: q, mode: "insensitive" } } },
        { creator: { email: { contains: q, mode: "insensitive" } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      city: true,
      locationName: true,
      status: true,
      visibility: true,
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { albums: { where: { deletedAt: null } } } },
    },
    orderBy: { startsAt: "desc" },
    take,
  });

  return events.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    city: e.city,
    locationName: e.locationName,
    status: e.status,
    visibility: e.visibility,
    organizerName: e.creator.name?.trim() || e.creator.email,
    albumCount: e._count.albums,
  }));
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
