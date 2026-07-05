import { Prisma } from "@/lib/prisma";
import {
  type AlbumSalesReadinessInput,
  isAlbumReadyToSell,
} from "@/lib/albums/album-sales-readiness";

export function publicAlbumFilter(): Prisma.AlbumWhereInput {
  return {
    isPublic: true,
    isHidden: false,
  };
}

export type AlbumAccessData = AlbumSalesReadinessInput & {
  isPublic?: boolean | null;
  isHidden?: boolean | null;
};

/** @deprecated Preferí `isAlbumReadyToSell` / `evaluateAlbumSalesReadiness`. Alias estable para checkout y diagnósticos. */
export function isAlbumComplete(album: AlbumAccessData): boolean {
  return isAlbumReadyToSell(album);
}

/**
 * Visibilidad pública del álbum: solo depende de isPublic e isHidden.
 * Sin estado "borrador"; el álbum está disponible con el link si es público y no está oculto.
 */
export function isAlbumPubliclyAccessible(album: AlbumAccessData): boolean {
  return album.isPublic === true && album.isHidden !== true;
}

/**
 * Álbum privado (no listado) pero accesible con link directo: isPublic=false e isHidden≠true.
 */
export function isAlbumUnlistedWithDirectLink(album: AlbumAccessData): boolean {
  return album.isHidden !== true && album.isPublic === false;
}

export type AlbumGalleryAccessContext = {
  isOwner?: boolean;
  isAdmin?: boolean;
  hasAlbumAccess?: boolean;
};

export type AlbumReactivationAccessData = AlbumAccessData & {
  firstPhotoDate?: Date | null;
  createdAt?: Date;
  expirationExtensionDays?: number | null;
};

/** Álbum oculto o fuera del período visible: cualquier visitante con el link puede pedir extensión. */
export function isAlbumEligibleForPublicReactivation(
  album: AlbumReactivationAccessData
): boolean {
  if (album.isHidden === true) return true;
  const baseDate = album.firstPhotoDate ?? album.createdAt;
  if (!baseDate) return false;
  const extensionDays = album.expirationExtensionDays ?? 0;
  const visibleUntil = new Date(
    baseDate.getTime() + (30 + extensionDays) * 24 * 60 * 60 * 1000
  );
  return new Date() >= visibleUntil;
}

/** Puede abrir la galería con la URL del álbum (listado público o link directo). */
export function canOpenAlbumGallery(
  album: AlbumReactivationAccessData,
  ctx: AlbumGalleryAccessContext = {}
): boolean {
  if (ctx.isOwner || ctx.isAdmin || ctx.hasAlbumAccess) return true;
  if (isAlbumEligibleForPublicReactivation(album)) return true;
  if (album.isHidden === true) return false;
  return isAlbumPubliclyAccessible(album) || isAlbumUnlistedWithDirectLink(album);
}
