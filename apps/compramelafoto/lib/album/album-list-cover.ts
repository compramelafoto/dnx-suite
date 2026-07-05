import { getR2PublicUrl } from "@/lib/r2-public-url";
import { buildPhotoViewApiUrl } from "@/lib/images/public-photo-view-url";

export type AlbumCoverPhotoRow = {
  id: number;
  originalKey?: string | null;
  previewUrl?: string | null;
  isRemoved?: boolean | null;
};

export type AlbumForListCover = {
  id: number;
  coverPhotoId?: number | null;
  coverThumbnailKey?: string | null;
  coverPhoto?: AlbumCoverPhotoRow | null;
  /** Primera foto activa (1 fila) cuando no hay portada explícita. */
  fallbackCoverPhoto?: AlbumCoverPhotoRow | null;
  /** @deprecated Usar fallbackCoverPhoto o photosCount; solo APIs públicas legacy. */
  photos?: AlbumCoverPhotoRow[];
  photosCount?: number;
};

function activePhotos(photos: AlbumCoverPhotoRow[] | undefined): AlbumCoverPhotoRow[] {
  if (!photos?.length) return [];
  return photos.filter((p) => p.isRemoved !== true);
}

/** Portada explícita del fotógrafo; si no hay, primera foto activa del álbum. */
export function resolveEffectiveListCoverPhoto(
  album: AlbumForListCover
): AlbumCoverPhotoRow | null {
  const designated = album.coverPhoto;
  if (designated?.id && designated.isRemoved !== true) {
    return designated;
  }
  const fallback = album.fallbackCoverPhoto;
  if (fallback?.id && fallback.isRemoved !== true) {
    return fallback;
  }
  return activePhotos(album.photos)[0] ?? null;
}

function hasExplicitCoverSelection(album: AlbumForListCover): boolean {
  return (
    album.coverPhotoId != null &&
    album.coverPhoto?.id != null &&
    album.coverPhotoId === album.coverPhoto.id
  );
}

export type ResolveAlbumListCoverOptions = {
  /** Reservado; las portadas de listado siempre usan `mode=cover` (sin marca). */
  maxMode?: "thumb" | "cover";
};

/**
 * URL de portada para grillas de álbumes (home, fotógrafo, dashboard).
 * Sin marca: miniatura R2 solo si hay portada elegida; si no, primera foto vía `mode=cover`.
 */
export function resolveAlbumListCoverUrl(
  album: AlbumForListCover,
  _options?: ResolveAlbumListCoverOptions
): string | null {
  const effective = resolveEffectiveListCoverPhoto(album);
  if (!effective?.id) return null;

  if (hasExplicitCoverSelection(album)) {
    const thumbKey = album.coverThumbnailKey?.trim();
    if (thumbKey) {
      try {
        return getR2PublicUrl(thumbKey);
      } catch {
        /* continuar con API */
      }
    }
  }

  return buildPhotoViewApiUrl(effective.id, album.id, "cover");
}

/** Fallback API (sin watermark) cuando la URL primaria es R2 rota u otra distinta. */
export function resolveAlbumListCoverUrlFallback(
  album: AlbumForListCover,
  primaryUrl: string | null
): string | null {
  const effective = resolveEffectiveListCoverPhoto(album);
  if (!effective?.id) return null;
  const apiUrl = buildPhotoViewApiUrl(effective.id, album.id, "cover");
  if (!primaryUrl || primaryUrl !== apiUrl) return apiUrl;
  return null;
}

/** URL primaria + fallback API para listados (home, fotógrafo, APIs públicas). */
export function buildAlbumListCoverUrls(album: AlbumForListCover): {
  coverPhotoUrl: string | null;
  coverPhotoUrlFallback: string | null;
} {
  const coverPhotoUrl = resolveAlbumListCoverUrl(album);
  const coverPhotoUrlFallback = resolveAlbumListCoverUrlFallback(album, coverPhotoUrl);
  return { coverPhotoUrl, coverPhotoUrlFallback };
}

export function countActiveAlbumPhotos(
  photosOrCount: AlbumCoverPhotoRow[] | number | undefined
): number {
  if (typeof photosOrCount === "number") {
    return photosOrCount;
  }
  return activePhotos(photosOrCount).length;
}

/** Sin fotos → cartel “próximamente”; con fotos → portada (aunque falte flag showComingSoon). */
export function shouldShowAlbumComingSoonCover(photosCount: number): boolean {
  return photosCount <= 0;
}
