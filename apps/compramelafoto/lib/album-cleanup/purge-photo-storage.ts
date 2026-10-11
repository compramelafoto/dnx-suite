import type { PhotoStorageCleanupStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteFace } from "@/lib/faces/rekognition";
import {
  faceRowsSafeToForget,
  hasPendingFaceDeletions,
  type FaceDeletionOutcome,
} from "@/lib/album-cleanup/face-rows-safe-to-forget";
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
  /**
   * Caras que Amazon no confirmó borradas y cuyas filas quedaron en la base para
   * reintentar. Mientras sea mayor que cero, la fila de la foto no se puede borrar.
   */
  pendingFaces: number;
};

/**
 * Le pide a Amazon que borre las caras de la foto y olvida de la base **sólo** las que
 * confirmó. Las que fallaron se quedan: su `rekognitionFaceId` es lo único con lo que se
 * puede volver a intentar.
 */
async function retireFaces(photoId: number): Promise<{
  externalOps: number;
  errors: string[];
  pending: number;
}> {
  const faceDetections = await prisma.faceDetection.findMany({
    where: { photoId },
    select: { id: true, rekognitionFaceId: true },
  });

  const errors: string[] = [];
  const outcomes: FaceDeletionOutcome[] = [];
  let externalOps = 0;

  for (const fd of faceDetections) {
    if (!fd.rekognitionFaceId) continue;
    externalOps += 1;
    try {
      await deleteFace(fd.rekognitionFaceId);
      outcomes.push({ id: fd.id, faceId: fd.rekognitionFaceId, deleted: true });
    } catch (err: unknown) {
      outcomes.push({ id: fd.id, faceId: fd.rekognitionFaceId, deleted: false });
      errors.push(
        `rekognition:${fd.rekognitionFaceId}:${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const olvidables = faceRowsSafeToForget(outcomes);
  if (olvidables.length > 0) {
    await prisma.faceDetection.deleteMany({ where: { id: { in: olvidables } } });
  }

  // Las filas sin `rekognitionFaceId` no tienen nada que borrar en Amazon.
  await prisma.faceDetection.deleteMany({
    where: { photoId, rekognitionFaceId: "" },
  });

  return {
    externalOps,
    errors,
    pending: hasPendingFaceDeletions(outcomes)
      ? outcomes.filter((o) => !o.deleted).length
      : 0,
  };
}

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
    /*
      La foto ya se purgó, pero puede haber quedado alguna cara que Amazon no confirmó
      —por ejemplo durante la suspensión de la cuenta del 2026-10-06—. Antes se salía de
      una y esas caras no se reintentaban nunca. Ahora se reintentan en cada corrida.
    */
    const reintento = await retireFaces(photo.id);
    return {
      photoId: photo.id,
      externalOps: reintento.externalOps,
      storagePurged: true,
      metadataPurged: Boolean(
        photo.storageCleanupStatus === "PURGED_WITH_REFERENCES" ||
          photo.storageCleanupStatus === "STORAGE_PURGED"
      ),
      finalStatus: photo.storageCleanupStatus ?? "STORAGE_PURGED",
      errors: [...errors, ...reintento.errors],
      pendingFaces: reintento.pending,
    };
  }

  const caras = await retireFaces(photo.id);
  externalOps += caras.externalOps;
  errors.push(...caras.errors);

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
    // `faceDetection` NO se borra acá: lo hace `retireFaces`, y sólo las que Amazon
    // confirmó. Borrarlas todas era lo que perdía los identificadores para siempre.
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
    pendingFaces: caras.pending,
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

  /*
    Si quedan caras que Amazon no confirmó borradas, la foto se queda.

    Borrar la fila de `Photo` arrastra las de `FaceDetection` en cascada, y con ellas el
    `rekognitionFaceId`: la cara quedaría viva en la colección de Amazon, sin nombre y
    cobrándose todos los meses. La foto se borra en la próxima corrida, cuando Amazon
    responda.
  */
  const carasPendientes = await prisma.faceDetection.count({ where: { photoId } });
  if (carasPendientes > 0) {
    return { deleted: false, skippedReason: "PENDING_REKOGNITION_FACES" };
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
