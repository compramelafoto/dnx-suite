/**
 * Crea CameraUploadLog (RECEIVED) + CameraIngestJob (PENDING) en una sola transacción.
 * Punto de entrada previsto para el FTP Gateway tras subir el raw a R2.
 */

import type { CameraIngestJob, CameraUploadLog, Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  CAMERA_UPLOAD_LOG_STATUS,
  isCameraUnassignedLogStatus,
} from "@/lib/camera-connection/camera-connection-types";
import { assertCameraIngestPrismaReady } from "@/lib/camera-connection/camera-ingest-job";

export type CreateCameraUploadLogAndEnqueueInput = {
  userId: number;
  albumId: number;
  rawKey: string;
  filename: string;
  filesizeBytes?: number | null;
  /** Reutiliza un log UNASSIGNED/AMBIGUOUS existente en lugar de crear otro. */
  existingUploadLogId?: number;
};

export type CreateCameraUploadLogAndEnqueueResult = {
  job: CameraIngestJob;
  log: CameraUploadLog;
  created: boolean;
};

export type ValidateCreateCameraUploadLogAndEnqueueError = {
  field: keyof CreateCameraUploadLogAndEnqueueInput;
  message: string;
};

function assertCameraUploadLogPrismaReady(): void {
  const delegate = (prisma as { cameraUploadLog?: { create?: unknown } }).cameraUploadLog;
  if (!delegate?.create) {
    throw new Error(
      "PRISMA_CLIENT_OUTDATED: Reiniciá el servidor de desarrollo después de npx prisma generate."
    );
  }
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

/** Valida el input (sin acceso a DB). */
export function validateCreateCameraUploadLogAndEnqueueInput(
  input: CreateCameraUploadLogAndEnqueueInput
): ValidateCreateCameraUploadLogAndEnqueueError | null {
  if (!isPositiveInt(input.userId)) {
    return { field: "userId", message: "userId debe ser un entero positivo." };
  }

  if (!isPositiveInt(input.albumId)) {
    return { field: "albumId", message: "albumId debe ser un entero positivo." };
  }

  const rawKey = input.rawKey?.trim();
  if (!rawKey) {
    return { field: "rawKey", message: "rawKey es obligatorio." };
  }

  const expectedPrefix = `albums/${input.albumId}/raw/`;
  if (!rawKey.startsWith(expectedPrefix)) {
    return {
      field: "rawKey",
      message: `rawKey debe comenzar con "${expectedPrefix}".`,
    };
  }

  const filename = input.filename?.trim();
  if (!filename) {
    return { field: "filename", message: "filename es obligatorio." };
  }

  if (input.filesizeBytes != null) {
    if (!isPositiveInt(input.filesizeBytes)) {
      return {
        field: "filesizeBytes",
        message: "filesizeBytes debe ser un entero positivo o null.",
      };
    }
  }

  return null;
}

async function resolveLogForExistingJob(
  tx: Prisma.TransactionClient,
  job: CameraIngestJob
): Promise<CameraUploadLog> {
  if (job.uploadLogId == null) {
    throw new Error(
      `CameraIngestJob ${job.id} existe sin CameraUploadLog asociado (rawKey: ${job.rawKey}).`
    );
  }

  const log = await tx.cameraUploadLog.findUnique({
    where: { id: job.uploadLogId },
  });

  if (!log) {
    throw new Error(
      `CameraUploadLog ${job.uploadLogId} no encontrado para job ${job.id}.`
    );
  }

  return log;
}

async function fetchExistingByRawKey(
  rawKey: string
): Promise<CreateCameraUploadLogAndEnqueueResult | null> {
  const job = await prisma.cameraIngestJob.findUnique({ where: { rawKey } });
  if (!job) return null;

  const log =
    job.uploadLogId != null
      ? await prisma.cameraUploadLog.findUnique({ where: { id: job.uploadLogId } })
      : null;

  if (!log) {
    throw new Error(
      `CameraIngestJob ${job.id} existe sin CameraUploadLog asociado (rawKey: ${rawKey}).`
    );
  }

  return { job, log, created: false };
}

/**
 * Crea log RECEIVED + job PENDING atómicamente.
 * Idempotente por `rawKey`: si el job ya existe, devuelve job + log existentes sin crear otro log.
 */
export async function createCameraUploadLogAndEnqueue(
  input: CreateCameraUploadLogAndEnqueueInput
): Promise<CreateCameraUploadLogAndEnqueueResult> {
  assertCameraIngestPrismaReady();
  assertCameraUploadLogPrismaReady();

  const validationError = validateCreateCameraUploadLogAndEnqueueInput(input);
  if (validationError) {
    throw new Error(validationError.message);
  }

  const rawKey = input.rawKey.trim();
  const filename = input.filename.trim();
  const filesizeBytes = input.filesizeBytes ?? null;

  try {
    return await prisma.$transaction(async (tx) => {
      const existingJob = await tx.cameraIngestJob.findUnique({ where: { rawKey } });
      if (existingJob) {
        const log = await resolveLogForExistingJob(tx, existingJob);
        return { job: existingJob, log, created: false };
      }

      let log: CameraUploadLog;

      if (input.existingUploadLogId != null) {
        const existingLog = await tx.cameraUploadLog.findUnique({
          where: { id: input.existingUploadLogId },
          include: { ingestJob: { select: { id: true } } },
        });

        if (!existingLog) {
          throw new Error(`CameraUploadLog no encontrado: ${input.existingUploadLogId}`);
        }
        if (existingLog.userId !== input.userId) {
          throw new Error("uploadLogId no pertenece al userId indicado.");
        }
        if (!isCameraUnassignedLogStatus(existingLog.status)) {
          throw new Error("El log no está en bandeja sin asignar.");
        }
        if (existingLog.ingestJob) {
          throw new Error("uploadLogId ya tiene un CameraIngestJob asociado.");
        }

        log = await tx.cameraUploadLog.update({
          where: { id: existingLog.id },
          data: {
            albumId: input.albumId,
            filename,
            filesize: filesizeBytes,
            status: CAMERA_UPLOAD_LOG_STATUS.RECEIVED,
            errorMessage: null,
            rawKey,
          },
        });
      } else {
        log = await tx.cameraUploadLog.create({
          data: {
            userId: input.userId,
            albumId: input.albumId,
            filename,
            filesize: filesizeBytes,
            status: CAMERA_UPLOAD_LOG_STATUS.RECEIVED,
            rawKey,
          },
        });
      }

      const job = await tx.cameraIngestJob.create({
        data: {
          userId: input.userId,
          albumId: input.albumId,
          rawKey,
          uploadLogId: log.id,
          originalFilename: filename,
          filesizeBytes,
          status: "PENDING",
        },
      });

      return { job, log, created: true };
    });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await fetchExistingByRawKey(rawKey);
      if (existing) {
        return existing;
      }
    }
    throw err;
  }
}
