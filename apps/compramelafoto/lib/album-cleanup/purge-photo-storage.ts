import type { PhotoStorageCleanupStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFace } from "@/lib/faces/rekognition";
import { deletePhotoR2Assets } from "@/lib/photo-r2-cleanup";
import { isPrismaFkViolation } from "@/lib/album-cleanup/destructive-delete";

export type PhotoPurgeSource = {
  id: number;
  albumId: number;
  originalKey: string;
  previewUrl: string;
  thumbWatermarkedKey?: string | null;
  previewWatermarkedKey?: string | null;
  storageCleanupStatus?: PhotoStorageCleanupStatus;
  storageDeletedAt?: Date | null;
};

export type PhotoPurgeResult = {
  photoId: number;
  externalOps: number;
  storagePurged: boolean;
  metadataPurged: boolean;
  finalStatus: PhotoStorageCleanupStatus;
  errors: string[];
};

function tombstoneKey(photoId: number, kind: "original" | "preview"): string {
  return `purged/photo-${photoId}/${kind}`;
}

export async function purgePhotoStorageAndMetadata(
  photo: PhotoPurgeSource,
  opts: { hasOrderItem: boolean }
): Promise<PhotoPurgeResult> {
  const errors: string[] = [];
  let externalOps = 0;

  if (photo.storageCleanupStatus !== "ACTIVE" && photo.storageDeletedAt) {
    return {
      photoId: photo.id,
      externalOps: 0,
      storagePurged: true,
      metadataPurged: Boolean(
        photo.storageCleanupStatus === "PURGED_WITH_REFERENCES" ||
          photo.storageCleanupStatus === "STORAGE_PURGED"
      ),
      finalStatus: photo.storageCleanupStatus ?? "STORAGE_PURGED",
      errors,
    };
  }

  const faceDetections = await prisma.faceDetection.findMany({
    where: { photoId: photo.id },
    select: { id: true, rekognitionFaceId: true },
  });

  for (const fd of faceDetections) {
    if (!fd.rekognitionFaceId) continue;
    externalOps += 1;
    try {
      await deleteFace(fd.rekognitionFaceId);
    } catch (err: unknown) {
      errors.push(
        `rekognition:${fd.rekognitionFaceId}:${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const hadR2Keys =
    photo.originalKey &&
    !photo.originalKey.startsWith("purged/") &&
    photo.previewUrl &&
    !photo.previewUrl.includes("purged/photo-");

  if (hadR2Keys) {
    externalOps += 1;
    try {
      await deletePhotoR2Assets({
        id: photo.id,
        originalKey: photo.originalKey,
        previewUrl: photo.previewUrl,
        thumbWatermarkedKey: photo.thumbWatermarkedKey,
        previewWatermarkedKey: photo.previewWatermarkedKey,
      });
    } catch (err: unknown) {
      errors.push(`r2:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const now = new Date();
  const finalStatus: PhotoStorageCleanupStatus = opts.hasOrderItem
    ? "PURGED_WITH_REFERENCES"
    : "STORAGE_PURGED";

  await prisma.$transaction([
    prisma.faceDetection.deleteMany({ where: { photoId: photo.id } }),
    prisma.ocrToken.deleteMany({ where: { photoId: photo.id } }),
    prisma.photoExifMetadata.deleteMany({ where: { photoId: photo.id } }),
    prisma.photoAnalysisJob.deleteMany({ where: { photoId: photo.id } }),
    prisma.photo.update({
      where: { id: photo.id },
      data: {
        originalKey: tombstoneKey(photo.id, "original"),
        previewUrl: tombstoneKey(photo.id, "preview"),
        thumbWatermarkedKey: null,
        previewWatermarkedKey: null,
        storageDeletedAt: now,
        metadataDeletedAt: now,
        storageCleanupStatus: finalStatus,
        exifMetadataStatus: "SKIPPED_EXPIRED",
        analysisStatus: "DONE",
      },
    }),
  ]);

  await prisma.album.updateMany({
    where: { coverPhotoId: photo.id },
    data: { coverPhotoId: null },
  });

  return {
    photoId: photo.id,
    externalOps,
    storagePurged: true,
    metadataPurged: true,
    finalStatus,
    errors,
  };
}

export type PhotoRowDeleteResult = {
  deleted: boolean;
  skippedReason?: string;
  error?: string;
  errorCode?: string;
};

export async function deletePhotoRowIfAllowed(
  photoId: number,
  hasOrderItem: boolean,
  opts: { destructiveDelete: boolean }
): Promise<PhotoRowDeleteResult> {
  if (!opts.destructiveDelete) {
    return { deleted: false, skippedReason: "DESTRUCTIVE_DELETE_DISABLED" };
  }
  if (hasOrderItem) {
    return { deleted: false, skippedReason: "ORDER_ITEM_REFERENCE" };
  }

  try {
    await prisma.photo.delete({ where: { id: photoId } });
    return { deleted: true };
  } catch (err: unknown) {
    if (isPrismaFkViolation(err)) {
      return {
        deleted: false,
        error: err instanceof Error ? err.message : String(err),
        errorCode:
          err instanceof Prisma.PrismaClientKnownRequestError ? err.code : "P2003",
      };
    }
    throw err;
  }
}
