import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, getR2ObjectMetadata, readFromR2 } from "@/lib/r2-client";
import { processPhoto } from "@/lib/image-processing";
import { schedulePhotoVariantsOnUpload } from "@/lib/images/generate-photo-variants";
import { extractCapturedAtFromBuffer } from "@/lib/photo-exif";
import { incrementPhotosUploaded } from "@/lib/platform-metrics";

export type FinalizeAlbumPhotoFromRawInput = {
  albumId: number;
  userId: number;
  key: string;
  eventFolderId?: number;
  folderId?: number;
  maxBytes: number;
  maxMb: number;
};

export type FinalizeAlbumPhotoFromRawResult = {
  photo: { id: number; previewUrl: string; originalKey: string };
};

/**
 * Procesa un archivo raw ya subido a R2 (albums/{id}/raw/...) y crea el registro Photo.
 */
export async function finalizeAlbumPhotoFromRaw(
  input: FinalizeAlbumPhotoFromRawInput
): Promise<FinalizeAlbumPhotoFromRawResult> {
  const { albumId, userId, key, eventFolderId, folderId, maxBytes, maxMb } = input;

  if (!key.startsWith(`albums/${albumId}/raw/`)) {
    throw new Error("Key inválida");
  }

  const folderData = {
    ...(eventFolderId != null ? { eventFolderId } : {}),
    ...(folderId != null ? { folderId } : {}),
  };

  const metadata = await getR2ObjectMetadata(key);
  if (metadata.size > maxBytes) {
    throw new Error(`El archivo supera el límite de ${maxMb}MB.`);
  }

  const buffer = await readFromR2(key);
  const fileKey = `${crypto.randomUUID()}.jpg`;
  const capturedAt = await extractCapturedAtFromBuffer(buffer);

  const { previewUrl, originalKey } = await processPhoto(
    buffer,
    fileKey,
    true,
    `albums/${albumId}`
  );

  let photo;
  try {
    photo = await prisma.photo.create({
      data: {
        albumId,
        userId,
        previewUrl,
        originalKey,
        capturedAt,
        analysisStatus: "PENDING",
        exifMetadataStatus: "PENDING",
        ...folderData,
      },
    });
  } catch (createErr: unknown) {
    const errorMsg = String((createErr as { message?: string })?.message ?? "");
    if (
      errorMsg.includes("userId") ||
      errorMsg.includes("isRemoved") ||
      errorMsg.includes("analysisStatus") ||
      errorMsg.includes("exifMetadataStatus") ||
      errorMsg.includes("eventFolderId") ||
      errorMsg.includes("folderId") ||
      errorMsg.includes("Unknown argument") ||
      errorMsg.includes("does not exist")
    ) {
      photo = await prisma.photo.create({
        data: { albumId, previewUrl, originalKey },
      });
    } else {
      throw createErr;
    }
  }

  if (folderId != null && typeof (photo as { folderId?: number | null }).folderId === "number") {
    console.info("[album-folder]", {
      albumId,
      photoId: photo.id,
      folderId,
    });
  }

  if (eventFolderId != null && typeof (photo as { eventFolderId?: number | null }).eventFolderId === "number") {
    console.info("[event-folder]", {
      albumId,
      photoId: photo.id,
      eventFolderId,
    });
  }

  try {
    await prisma.photoAnalysisJob.create({
      data: {
        photoId: photo.id,
        status: "PENDING",
      },
    });
  } catch (jobErr: unknown) {
    const msg = String((jobErr as { message?: string })?.message ?? "");
    if (
      !msg.includes("PhotoAnalysisJob") &&
      !msg.includes("Unknown argument") &&
      !msg.includes("does not exist")
    ) {
      console.error("Error creando PhotoAnalysisJob:", jobErr);
    }
  }

  schedulePhotoVariantsOnUpload({
    id: photo.id,
    albumId,
    previewUrl,
    originalKey,
    createdAt: photo.createdAt,
  });

  await incrementPhotosUploaded(1).catch((err) => {
    console.warn("incrementPhotosUploaded:", err);
  });

  try {
    const albumCheck = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        coverPhotoId: true,
        firstPhotoDate: true,
        expiresAt: true,
      },
    });
    if (albumCheck) {
      const updateData: Record<string, unknown> = {};
      if (!albumCheck.coverPhotoId) {
        updateData.coverPhotoId = photo.id;
      }
      if (!albumCheck.firstPhotoDate) {
        updateData.firstPhotoDate = new Date();
      }
      if (!albumCheck.expiresAt) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        updateData.expiresAt = expiresAt;
      }
      if (Object.keys(updateData).length > 0) {
        try {
          await prisma.album.update({
            where: { id: albumId },
            data: updateData,
          });
        } catch (updateErr: unknown) {
          const errorMsg = String((updateErr as { message?: string })?.message ?? "");
          if (
            !errorMsg.includes("coverPhotoId") &&
            !errorMsg.includes("firstPhotoDate") &&
            !errorMsg.includes("Unknown argument")
          ) {
            console.error("Error actualizando álbum:", updateErr);
          }
        }
      }
    }
  } catch (albumErr) {
    console.error("Error revisando portada/fechas de álbum:", albumErr);
  }

  try {
    await deleteFromR2(key);
  } catch (deleteErr) {
    console.warn("No se pudo eliminar archivo raw en R2:", deleteErr);
  }

  return {
    photo: { id: photo.id, previewUrl, originalKey },
  };
}
