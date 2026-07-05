/**
 * Encolado de ingesta de fotos desde Conexión de Cámara (FTP Gateway futuro).
 */

import type { CameraIngestJob, Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  assertCameraIngestPrismaReady,
  validateEnqueueCameraIngestInput,
  type EnqueueCameraIngestInput,
} from "@/lib/camera-connection/camera-ingest-job";

export type { EnqueueCameraIngestInput } from "@/lib/camera-connection/camera-ingest-job";

export type EnqueueCameraIngestResult = {
  job: CameraIngestJob;
  created: boolean;
};

function trimOptionalString(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function findJobByRawKey(
  tx: Prisma.TransactionClient,
  rawKey: string
): Promise<CameraIngestJob | null> {
  return tx.cameraIngestJob.findUnique({ where: { rawKey } });
}

async function assertUploadLogMatchesEnqueue(
  tx: Prisma.TransactionClient,
  input: EnqueueCameraIngestInput
): Promise<void> {
  const log = await tx.cameraUploadLog.findUnique({
    where: { id: input.uploadLogId },
    select: { id: true, userId: true, albumId: true, ingestJob: { select: { id: true } } },
  });

  if (!log) {
    throw new Error(`CameraUploadLog no encontrado: ${input.uploadLogId}`);
  }

  if (log.userId !== input.userId) {
    throw new Error("uploadLogId no pertenece al userId indicado.");
  }

  if (log.albumId != null && log.albumId !== input.albumId) {
    throw new Error("uploadLogId no coincide con el albumId indicado.");
  }

  if (log.ingestJob?.id) {
    throw new Error("uploadLogId ya tiene un CameraIngestJob asociado.");
  }
}

/**
 * Crea un `CameraIngestJob` en estado PENDING dentro de una transacción.
 * Idempotente por `rawKey`: si ya existe un job con la misma key, devuelve el existente.
 */
export async function enqueueCameraIngest(
  input: EnqueueCameraIngestInput
): Promise<EnqueueCameraIngestResult> {
  assertCameraIngestPrismaReady();

  const validationError = validateEnqueueCameraIngestInput(input);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const rawKey = input.rawKey.trim();
  const originalFilename = trimOptionalString(input.originalFilename ?? null);

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await findJobByRawKey(tx, rawKey);
      if (existing) {
        return { job: existing, created: false };
      }

      await assertUploadLogMatchesEnqueue(tx, input);

      const job = await tx.cameraIngestJob.create({
        data: {
          userId: input.userId,
          albumId: input.albumId,
          rawKey,
          uploadLogId: input.uploadLogId,
          originalFilename,
          filesizeBytes: input.filesizeBytes ?? null,
          status: "PENDING",
        },
      });

      return { job, created: true };
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.cameraIngestJob.findUnique({ where: { rawKey } });
      if (existing) {
        return { job: existing, created: false };
      }
    }
    throw err;
  }
}
