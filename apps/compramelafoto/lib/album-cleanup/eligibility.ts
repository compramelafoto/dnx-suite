import type { Album } from "@prisma/client";
import { getAlbumCleanupConfig } from "@/lib/album-cleanup/config";

const MS_PER_DAY = 86_400_000;

export type AlbumRetentionFields = Pick<
  Album,
  "firstPhotoDate" | "isHidden" | "deletedAt" | "cleanupStatus"
> & {
  expirationExtensionDays: number | null;
};

export function computeAlbumHideAt(album: AlbumRetentionFields): Date | null {
  if (!album.firstPhotoDate) return null;
  const { hideAfterDays } = getAlbumCleanupConfig();
  const extension = album.expirationExtensionDays ?? 0;
  return new Date(
    album.firstPhotoDate.getTime() + (hideAfterDays + extension) * MS_PER_DAY
  );
}

export function computeAlbumPurgeAt(album: AlbumRetentionFields): Date | null {
  if (!album.firstPhotoDate) return null;
  const { retentionDays } = getAlbumCleanupConfig();
  const extension = album.expirationExtensionDays ?? 0;
  return new Date(
    album.firstPhotoDate.getTime() + (retentionDays + extension) * MS_PER_DAY
  );
}

export function isAlbumPastHideDate(album: AlbumRetentionFields, now = new Date()): boolean {
  const hideAt = computeAlbumHideAt(album);
  return hideAt != null && now.getTime() >= hideAt.getTime();
}

export function isAlbumPastPurgeDate(album: AlbumRetentionFields, now = new Date()): boolean {
  const purgeAt = computeAlbumPurgeAt(album);
  return purgeAt != null && now.getTime() >= purgeAt.getTime();
}

export function isAlbumInActiveCleanup(album: AlbumRetentionFields): boolean {
  return (
    album.cleanupStatus === "PENDING" ||
    album.cleanupStatus === "PROCESSING" ||
    album.cleanupStatus === "BLOCKED_PRINT"
  );
}

export function isAlbumEligibleForExifScan(album: AlbumRetentionFields, now = new Date()): boolean {
  if (album.deletedAt) return false;
  if (album.isHidden) return false;
  if (isAlbumPastPurgeDate(album, now)) return false;
  if (isAlbumInActiveCleanup(album)) return false;
  if (
    album.cleanupStatus === "COMPLETED" ||
    album.cleanupStatus === "COMPLETED_WITH_REFERENCES"
  ) {
    return false;
  }
  return true;
}
