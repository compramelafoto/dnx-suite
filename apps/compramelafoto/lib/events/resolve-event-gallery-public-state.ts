import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export type EventGalleryPublicState =
  | "AVAILABLE"
  | "EMPTY_NEW"
  | "EXPIRED_REACTIVABLE"
  | "DELETED_FINAL"
  | "INCOMPLETE_ALBUM_CONFIG"
  | "ONLY_REMOVED_PHOTOS";

export type ReactivatableEventAlbum = {
  id: number;
  title: string | null;
  publicSlug: string | null;
  firstPhotoDate: Date | null;
  expirationExtensionDays: number | null;
};

export type EventGalleryPublicStateDiagnostics = {
  albumsCount: number;
  albumsWithFirstPhotoDate: number;
  hiddenAlbumsCount: number;
  totalPhotosCount: number;
  removedPhotosCount: number;
  ordersCount: number;
  commissionsCount: number;
};

export type ResolveEventGalleryPublicStateResult = {
  state: EventGalleryPublicState;
  reason: string;
  reactivatableAlbums: ReactivatableEventAlbum[];
  diagnostics: EventGalleryPublicStateDiagnostics;
};

type EventAlbumRow = {
  id: number;
  title: string;
  publicSlug: string;
  firstPhotoDate: Date | null;
  isHidden: boolean;
  isPublic: boolean;
  deletedAt: Date | null;
  expirationExtensionDays: number;
  enablePrintedPhotos: boolean;
  enableDigitalPhotos: boolean;
  selectedLabId: number | null;
  albumProfitMarginPercent: number | null;
  pickupBy: string | null;
  digitalPhotoPriceCents: number | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
};

type EventPhotoRow = {
  id: number;
  albumId: number;
  isRemoved: boolean;
};

function albumForAccessHelpers(album: EventAlbumRow) {
  return {
    isPublic: album.isPublic,
    isHidden: album.isHidden,
    enablePrintedPhotos: album.enablePrintedPhotos,
    enableDigitalPhotos: album.enableDigitalPhotos,
    selectedLabId: album.selectedLabId,
    albumProfitMarginPercent: album.albumProfitMarginPercent,
    pickupBy: album.pickupBy,
    digitalPhotoPriceCents: album.digitalPhotoPriceCents,
    termsAcceptedAt: album.termsAcceptedAt,
    termsVersion: album.termsVersion,
  };
}

function countPhotosThatWouldBePubliclyAvailable(
  photos: EventPhotoRow[],
  albumById: Map<number, EventAlbumRow>
): number {
  return photos.filter((photo) => {
    if (photo.isRemoved) return false;
    const album = albumById.get(photo.albumId);
    if (!album || album.deletedAt) return false;
    const access = albumForAccessHelpers(album);
    return isAlbumPubliclyAccessible(access);
  }).length;
}

function buildReactivatableAlbums(albums: EventAlbumRow[]): ReactivatableEventAlbum[] {
  return albums
    .filter(
      (album) =>
        album.deletedAt == null &&
        album.isHidden &&
        album.firstPhotoDate != null
    )
    .map((album) => ({
      id: album.id,
      title: album.title,
      publicSlug: album.publicSlug,
      firstPhotoDate: album.firstPhotoDate,
      expirationExtensionDays: album.expirationExtensionDays ?? 0,
    }));
}

function buildDiagnostics(
  albums: EventAlbumRow[],
  photos: EventPhotoRow[],
  ordersCount: number,
  commissionsCount: number
): EventGalleryPublicStateDiagnostics {
  return {
    albumsCount: albums.length,
    albumsWithFirstPhotoDate: albums.filter((album) => album.firstPhotoDate != null).length,
    hiddenAlbumsCount: albums.filter((album) => album.isHidden).length,
    totalPhotosCount: photos.length,
    removedPhotosCount: photos.filter((photo) => photo.isRemoved).length,
    ordersCount,
    commissionsCount,
  };
}

function hasHistoricalActivity(diagnostics: EventGalleryPublicStateDiagnostics): boolean {
  return (
    diagnostics.ordersCount > 0 ||
    diagnostics.commissionsCount > 0 ||
    diagnostics.albumsWithFirstPhotoDate > 0
  );
}

/**
 * Estado público agregado de la galería de un evento colaborativo (/g/[shareSlug]).
 * No persiste en DB; sin campos de lifecycle en Event puede no distinguir eventos
 * cuyo cron borró álbumes/fotos sin dejar órdenes ni comisiones (→ EMPTY_NEW).
 */
export async function resolveEventGalleryPublicState(input: {
  eventId: number;
  availablePhotosCount: number;
}): Promise<ResolveEventGalleryPublicStateResult> {
  const { eventId, availablePhotosCount } = input;

  const [albums, photos, ordersCount, commissionsCount] = await Promise.all([
    prisma.album.findMany({
      where: { eventId, deletedAt: null },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        firstPhotoDate: true,
        isHidden: true,
        isPublic: true,
        deletedAt: true,
        expirationExtensionDays: true,
        enablePrintedPhotos: true,
        enableDigitalPhotos: true,
        selectedLabId: true,
        albumProfitMarginPercent: true,
        pickupBy: true,
        digitalPhotoPriceCents: true,
        termsAcceptedAt: true,
        termsVersion: true,
      },
    }),
    prisma.photo.findMany({
      where: { album: { eventId } },
      select: { id: true, albumId: true, isRemoved: true },
    }),
    prisma.order.count({
      where: { album: { eventId } },
    }),
    prisma.eventOrganizerCommission.count({
      where: { eventId },
    }),
  ]);

  const diagnostics = buildDiagnostics(albums, photos, ordersCount, commissionsCount);
  const albumById = new Map(albums.map((album) => [album.id, album]));
  const reactivatableAlbums = buildReactivatableAlbums(albums);

  const emptyResult = (
    state: EventGalleryPublicState,
    reason: string,
    options?: { warn?: "deleted_final_without_albums" | "incomplete_album_config" | "no_historical_signal_without_lifecycle_fields" }
  ): ResolveEventGalleryPublicStateResult => {
    if (options?.warn === "deleted_final_without_albums") {
      console.warn(
        `[resolveEventGalleryPublicState] deleted_final_without_albums eventId=${eventId}`
      );
    } else if (options?.warn === "incomplete_album_config") {
      console.warn(
        `[resolveEventGalleryPublicState] incomplete_album_config eventId=${eventId}`
      );
    } else if (options?.warn === "no_historical_signal_without_lifecycle_fields") {
      console.warn(
        `[resolveEventGalleryPublicState] no_historical_signal_without_lifecycle_fields eventId=${eventId}`
      );
    }

    return {
      state,
      reason,
      reactivatableAlbums:
        state === "EXPIRED_REACTIVABLE" ? reactivatableAlbums : [],
      diagnostics,
    };
  };

  if (availablePhotosCount > 0) {
    return {
      state: "AVAILABLE",
      reason: "available_photos_visible",
      reactivatableAlbums: [],
      diagnostics,
    };
  }

  const nonRemovedPhotosCount = photos.length - diagnostics.removedPhotosCount;

  if (diagnostics.totalPhotosCount > 0 && nonRemovedPhotosCount === 0) {
    return emptyResult("ONLY_REMOVED_PHOTOS", "all_event_photos_marked_removed");
  }

  if (reactivatableAlbums.length > 0) {
    return emptyResult(
      "EXPIRED_REACTIVABLE",
      "hidden_albums_with_first_photo_date"
    );
  }

  const wouldBeAvailableCount = countPhotosThatWouldBePubliclyAvailable(photos, albumById);
  if (nonRemovedPhotosCount > 0 && wouldBeAvailableCount === 0) {
    return emptyResult("INCOMPLETE_ALBUM_CONFIG", "non_removed_photos_fail_public_gates", {
      warn: "incomplete_album_config",
    });
  }

  if (hasHistoricalActivity(diagnostics)) {
    const warn =
      diagnostics.albumsCount === 0 ? ("deleted_final_without_albums" as const) : undefined;
    return emptyResult("DELETED_FINAL", "historical_activity_without_reactivatable_albums", {
      warn,
    });
  }

  return emptyResult("EMPTY_NEW", "no_historical_signal_without_lifecycle_fields", {
    warn: "no_historical_signal_without_lifecycle_fields",
  });
}
