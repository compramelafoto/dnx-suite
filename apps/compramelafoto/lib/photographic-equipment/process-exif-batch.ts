import { prisma } from "@/lib/prisma";
import { readFromR2, urlToR2Key } from "@/lib/r2-client";
import { getExifDeviceScanBatchSize } from "@/lib/photographic-equipment/config";
import { pendingExifPhotoWhere } from "@/lib/photographic-equipment/pending-photos";
import { processPhotoExifFromBuffer } from "@/lib/photographic-equipment/process-photo-exif";
import { skipExpiredExifBacklog } from "@/lib/photographic-equipment/skip-expired-exif";

export type ExifDeviceScanBatchResult = {
  processed: number;
  withExif: number;
  noExif: number;
  failed: number;
  skippedExpired: number;
  durationMs: number;
  skipped: boolean;
  reason?: string;
};

function resolveOriginalKey(originalKey: string): string {
  try {
    return urlToR2Key(originalKey);
  } catch {
    return originalKey.replace(/^\//, "");
  }
}

export async function runExifDeviceScanBatch(
  batchSize = getExifDeviceScanBatchSize()
): Promise<ExifDeviceScanBatchResult> {
  const started = Date.now();
  let withExif = 0;
  let noExif = 0;
  let failed = 0;
  const skippedExpired = await skipExpiredExifBacklog(getExifDeviceScanBatchSize() * 5);

  const pendingPhotos = await prisma.photo.findMany({
    where: pendingExifPhotoWhere,
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      albumId: true,
      userId: true,
      originalKey: true,
      createdAt: true,
      capturedAt: true,
      storageDeletedAt: true,
      exifMetadataStatus: true,
      album: {
        select: {
          userId: true,
          deletedAt: true,
          isHidden: true,
          firstPhotoDate: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
        },
      },
    },
  });

  if (pendingPhotos.length === 0) {
    return {
      processed: 0,
      withExif: 0,
      noExif: 0,
      failed: 0,
      skippedExpired,
      durationMs: Date.now() - started,
      skipped: true,
      reason: "idle",
    };
  }

  for (const photo of pendingPhotos) {
    try {
      const key = resolveOriginalKey(photo.originalKey);
      const buffer = await readFromR2(key);
      const result = await processPhotoExifFromBuffer(
        {
          id: photo.id,
          albumId: photo.albumId,
          userId: photo.userId,
          albumUserId: photo.album.userId,
          createdAt: photo.createdAt,
          capturedAt: photo.capturedAt,
          storageDeletedAt: photo.storageDeletedAt,
          originalKey: photo.originalKey,
          exifMetadataStatus: photo.exifMetadataStatus,
          album: photo.album,
        },
        buffer
      );

      if (result.outcome === "analyzed") {
        withExif += 1;
      } else if (result.outcome === "no_exif" || result.outcome === "skipped_expired") {
        noExif += 1;
      } else if (result.outcome === "failed") {
        failed += 1;
        console.warn("[exif-device-scan] Error procesando foto", photo.id, result.error);
      }
    } catch (err: unknown) {
      failed += 1;
      console.warn("[exif-device-scan] Error leyendo foto", photo.id, err);
    }
  }

  return {
    processed: pendingPhotos.length,
    withExif,
    noExif,
    failed,
    skippedExpired,
    durationMs: Date.now() - started,
    skipped: false,
  };
}
