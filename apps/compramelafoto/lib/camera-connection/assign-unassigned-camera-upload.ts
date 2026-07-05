/**
 * Asigna manualmente una foto FTP sin destino a un álbum y encola ingesta estándar.
 */

import { prisma } from "@/lib/prisma";
import { copyInR2, deleteFromR2, fileExistsInR2, generateR2Key } from "@/lib/r2-client";
import { createCameraUploadLogAndEnqueue } from "@/lib/camera-connection/create-camera-upload-log-and-enqueue";
import { validateActiveAlbumForCameraConnection } from "@/lib/camera-connection/camera-connection-service";
import { isCameraUnassignedLogStatus } from "@/lib/camera-connection/camera-connection-types";
import { isCameraUnassignedRawKey } from "@/lib/camera-connection/camera-unassigned-raw";

export type AssignUnassignedCameraUploadInput = {
  userId: number;
  uploadLogId: number;
  albumId: number;
};

export type AssignUnassignedCameraUploadResult =
  | { ok: true; jobId: string; logId: number; rawKey: string }
  | { ok: false; error: string; status: 400 | 403 | 404 | 409 | 500 };

export async function assignUnassignedCameraUploadToAlbum(
  input: AssignUnassignedCameraUploadInput
): Promise<AssignUnassignedCameraUploadResult> {
  const { userId, uploadLogId, albumId } = input;

  const albumCheck = await validateActiveAlbumForCameraConnection(userId, albumId);
  if (!albumCheck.ok) {
    return { ok: false, error: albumCheck.error, status: albumCheck.status };
  }

  const log = await prisma.cameraUploadLog.findFirst({
    where: { id: uploadLogId, userId },
    include: { ingestJob: { select: { id: true } } },
  });

  if (!log) {
    return { ok: false, error: "Registro no encontrado.", status: 404 };
  }

  if (!isCameraUnassignedLogStatus(log.status)) {
    return {
      ok: false,
      error: "Esta foto ya fue asignada o no está en la bandeja sin asignar.",
      status: 409,
    };
  }

  if (log.ingestJob) {
    return {
      ok: false,
      error: "Esta foto ya tiene un trabajo de ingesta asociado.",
      status: 409,
    };
  }

  const stagingKey = log.rawKey?.trim();
  if (!stagingKey || !isCameraUnassignedRawKey(stagingKey)) {
    return {
      ok: false,
      error: "El archivo original no está disponible para reasignar.",
      status: 400,
    };
  }

  const stagingExists = await fileExistsInR2(stagingKey);
  if (!stagingExists) {
    return {
      ok: false,
      error: "El archivo original ya no existe en almacenamiento.",
      status: 404,
    };
  }

  const destKey = generateR2Key(log.filename, `albums/${albumId}/raw`);

  try {
    await copyInR2(stagingKey, destKey, "image/jpeg");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `No se pudo mover el archivo al álbum: ${message}`,
      status: 500,
    };
  }

  try {
    const { job, log: updatedLog } = await createCameraUploadLogAndEnqueue({
      userId,
      albumId,
      rawKey: destKey,
      filename: log.filename,
      filesizeBytes: log.filesize,
      existingUploadLogId: log.id,
    });

    try {
      await deleteFromR2(stagingKey);
    } catch {
      // El job ya apunta al destino; el staging huérfano se puede limpiar después.
    }

    return {
      ok: true,
      jobId: job.id,
      logId: updatedLog.id,
      rawKey: destKey,
    };
  } catch (err) {
    try {
      await deleteFromR2(destKey);
    } catch {
      // ignore
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, status: 500 };
  }
}
