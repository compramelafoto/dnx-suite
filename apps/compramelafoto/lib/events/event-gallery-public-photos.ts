import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import {
  buildPhotoViewApiUrl,
  type PublicPhotoViewMode,
} from "@/lib/images/public-photo-view-url";

type EventGalleryAlbumAccess = Parameters<typeof isAlbumPubliclyAccessible>[0];

/**
 * Fotos visibles en la galería colaborativa `/g/[shareSlug]`.
 * No exige álbum "completo" (precios/MP): el checkout y `/api/photos/.../view`
 * ya permiten thumb/preview en eventos colaborativos.
 */
export function isEventGalleryPhotoAlbumAccessible(
  album: EventGalleryAlbumAccess | null | undefined
): boolean {
  return Boolean(album && isAlbumPubliclyAccessible(album));
}

export function filterEventGalleryPublicPhotos<
  T extends { album: EventGalleryAlbumAccess | null | undefined },
>(photos: T[]): T[] {
  return photos.filter((photo) => isEventGalleryPhotoAlbumAccessible(photo.album));
}

export function buildEventGalleryPhotoGridItem(params: {
  id: number;
  albumId: number;
  photographerId?: number | null;
  photographerName?: string | null;
  mode?: PublicPhotoViewMode;
}): {
  id: string;
  src: string;
  alt: string;
  albumId: number;
  photographerId: number | null;
  photographerName: string | null;
} {
  const mode = params.mode ?? "thumb";
  return {
    id: String(params.id),
    src: buildPhotoViewApiUrl(params.id, params.albumId, mode),
    alt: `Foto ${params.id}`,
    albumId: params.albumId,
    photographerId: params.photographerId ?? null,
    photographerName: params.photographerName ?? null,
  };
}
