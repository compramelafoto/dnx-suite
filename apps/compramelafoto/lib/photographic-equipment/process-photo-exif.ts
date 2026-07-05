import type { PhotoExifMetadataStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { isAlbumEligibleForExifScan, type AlbumRetentionFields } from "@/lib/album-cleanup/eligibility";
import { hasUsefulDeviceData } from "@/lib/photographic-equipment/device-inference";
import { extractExifMetadata } from "@/lib/photographic-equipment/extract-exif-metadata";
import { upsertGearFromObservation } from "@/lib/photographic-equipment/upsert-gear";

export type PhotoExifProcessContext = {
  id: number;
  albumId: number;
  userId: number | null;
  albumUserId: number;
  createdAt: Date;
  capturedAt: Date | null;
  storageDeletedAt: Date | null;
  originalKey: string;
  exifMetadataStatus: PhotoExifMetadataStatus | null;
  album: AlbumRetentionFields;
};

export type PhotoExifProcessResult = {
  outcome: "skipped_already_done" | "skipped_expired" | "analyzed" | "no_exif" | "failed";
  error?: string;
};

function isExifPending(status: PhotoExifMetadataStatus | null): boolean {
  return status === "PENDING" || status == null;
}

async function markPhotoExifStatus(
  photoId: number,
  status: PhotoExifMetadataStatus,
  analyzedAt: Date
): Promise<void> {
  await prisma.photo.update({
    where: { id: photoId },
    data: {
      exifMetadataStatus: status,
      exifMetadataAnalyzedAt: analyzedAt,
    },
  });

  const existing = await prisma.photoExifMetadata.findUnique({
    where: { photoId },
    select: { id: true },
  });

  if (existing) {
    await prisma.photoExifMetadata.update({
      where: { photoId },
      data: {
        status,
        analyzedAt,
        error: status === "FAILED" ? undefined : null,
      },
    });
  }
}

/**
 * Procesa EXIF de equipos desde un buffer ya leído (p. ej. pipeline de análisis).
 * No relée R2. Si la foto ya tiene EXIF procesado, no hace nada.
 */
export async function processPhotoExifFromBuffer(
  photo: PhotoExifProcessContext,
  buffer: Buffer
): Promise<PhotoExifProcessResult> {
  if (!isExifPending(photo.exifMetadataStatus)) {
    return { outcome: "skipped_already_done" };
  }

  if (!isAlbumEligibleForExifScan(photo.album)) {
    const analyzedAt = new Date();
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        exifMetadataStatus: "SKIPPED_EXPIRED",
        exifMetadataAnalyzedAt: analyzedAt,
      },
    });
    return { outcome: "skipped_expired" };
  }

  if (photo.storageDeletedAt || photo.originalKey.startsWith("purged/")) {
    const analyzedAt = new Date();
    await prisma.photo.update({
      where: { id: photo.id },
      data: {
        exifMetadataStatus: "SKIPPED_EXPIRED",
        exifMetadataAnalyzedAt: analyzedAt,
      },
    });
    return { outcome: "skipped_expired" };
  }

  const analyzedAt = new Date();
  const photographerId = photo.userId ?? photo.albumUserId;

  try {
    const exif = await extractExifMetadata(buffer);

    if (!exif) {
      await prisma.photoExifMetadata.upsert({
        where: { photoId: photo.id },
        create: {
          photoId: photo.id,
          photographerId,
          status: "NO_EXIF",
          analyzedAt,
        },
        update: {
          status: "NO_EXIF",
          analyzedAt,
          error: null,
          deviceId: null,
        },
      });
      await markPhotoExifStatus(photo.id, "NO_EXIF", analyzedAt);
      return { outcome: "no_exif" };
    }

    if (!hasUsefulDeviceData(exif.make, exif.model, exif.serialNumber)) {
      await prisma.photoExifMetadata.upsert({
        where: { photoId: photo.id },
        create: {
          photoId: photo.id,
          photographerId,
          make: exif.make,
          model: exif.model,
          serialNumber: exif.serialNumber,
          lensMake: exif.lensMake,
          lensModel: exif.lensModel,
          focalLength: exif.focalLength,
          exposureTime: exif.exposureTime,
          aperture: exif.aperture,
          iso: exif.iso,
          takenAt: exif.takenAt ?? photo.capturedAt,
          gpsLat: exif.gpsLat,
          gpsLng: exif.gpsLng,
          status: "NO_EXIF",
          analyzedAt,
        },
        update: {
          make: exif.make,
          model: exif.model,
          serialNumber: exif.serialNumber,
          lensMake: exif.lensMake,
          lensModel: exif.lensModel,
          focalLength: exif.focalLength,
          exposureTime: exif.exposureTime,
          aperture: exif.aperture,
          iso: exif.iso,
          takenAt: exif.takenAt ?? photo.capturedAt,
          gpsLat: exif.gpsLat,
          gpsLng: exif.gpsLng,
          status: "NO_EXIF",
          analyzedAt,
          error: null,
          deviceId: null,
        },
      });
      await markPhotoExifStatus(photo.id, "NO_EXIF", analyzedAt);
      return { outcome: "no_exif" };
    }

    const seenAt = exif.takenAt ?? photo.capturedAt ?? photo.createdAt;

    const gear = await upsertGearFromObservation({
      photographerId,
      photoId: photo.id,
      albumId: photo.albumId,
      uploadedAt: photo.createdAt,
      exif,
      seenAt,
    });

    await prisma.photoExifMetadata.upsert({
      where: { photoId: photo.id },
      create: {
        photoId: photo.id,
        photographerId,
        deviceId: null,
        make: exif.make,
        model: exif.model,
        serialNumber: exif.serialNumber,
        lensMake: exif.lensMake,
        lensModel: exif.lensModel,
        focalLength: exif.focalLength,
        exposureTime: exif.exposureTime,
        aperture: exif.aperture,
        iso: exif.iso,
        takenAt: exif.takenAt ?? photo.capturedAt,
        gpsLat: exif.gpsLat,
        gpsLng: exif.gpsLng,
        status: "ANALYZED",
        analyzedAt,
      },
      update: {
        photographerId,
        deviceId: null,
        make: exif.make,
        model: exif.model,
        serialNumber: exif.serialNumber,
        lensMake: exif.lensMake,
        lensModel: exif.lensModel,
        focalLength: exif.focalLength,
        exposureTime: exif.exposureTime,
        aperture: exif.aperture,
        iso: exif.iso,
        takenAt: exif.takenAt ?? photo.capturedAt,
        gpsLat: exif.gpsLat,
        gpsLng: exif.gpsLng,
        status: "ANALYZED",
        analyzedAt,
        error: null,
      },
    });

    if (!gear.cameraBody) {
      await markPhotoExifStatus(photo.id, "NO_EXIF", analyzedAt);
      return { outcome: "no_exif" };
    }

    await markPhotoExifStatus(photo.id, "ANALYZED", analyzedAt);
    return { outcome: "analyzed" };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    try {
      await prisma.photoExifMetadata.upsert({
        where: { photoId: photo.id },
        create: {
          photoId: photo.id,
          photographerId,
          status: "FAILED",
          analyzedAt,
          error: errorMessage.slice(0, 2000),
        },
        update: {
          status: "FAILED",
          analyzedAt,
          error: errorMessage.slice(0, 2000),
        },
      });
      await markPhotoExifStatus(photo.id, "FAILED", analyzedAt);
    } catch (persistErr) {
      console.error("[photo-exif] No se pudo persistir FAILED:", photo.id, persistErr);
    }

    return { outcome: "failed", error: errorMessage };
  }
}
