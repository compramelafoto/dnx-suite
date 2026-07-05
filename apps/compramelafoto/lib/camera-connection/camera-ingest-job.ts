/**
 * Persistencia y helpers de cola CameraIngestJob (Conexión de Cámara).
 * El worker consumirá estas funciones en una fase posterior.
 */

import type { CameraIngestJob } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const LAST_ERROR_MAX_LENGTH = 500;

export type EnqueueCameraIngestInput = {
  userId: number;
  albumId: number;
  rawKey: string;
  uploadLogId: number;
  originalFilename?: string | null;
  filesizeBytes?: number | null;
};

export type ValidateEnqueueCameraIngestError = {
  field: keyof EnqueueCameraIngestInput | "rawKey";
  message: string;
};

export function assertCameraIngestPrismaReady(): void {
  const delegate = (prisma as { cameraIngestJob?: { findUnique?: unknown } }).cameraIngestJob;
  if (!delegate?.findUnique) {
    throw new Error(
      "PRISMA_CLIENT_OUTDATED: Reiniciá el servidor de desarrollo después de npx prisma generate."
    );
  }
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function truncateError(message: string): string {
  return message.slice(0, LAST_ERROR_MAX_LENGTH);
}

/** Valida el input mínimo de encolado (sin acceso a DB). */
export function validateEnqueueCameraIngestInput(
  input: EnqueueCameraIngestInput
): ValidateEnqueueCameraIngestError | null {
  if (!isPositiveInt(input.userId)) {
    return { field: "userId", message: "userId debe ser un entero positivo." };
  }

  if (!isPositiveInt(input.albumId)) {
    return { field: "albumId", message: "albumId debe ser un entero positivo." };
  }

  if (!isPositiveInt(input.uploadLogId)) {
    return { field: "uploadLogId", message: "uploadLogId debe ser un entero positivo." };
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

  if (input.filesizeBytes != null) {
    if (!Number.isInteger(input.filesizeBytes) || input.filesizeBytes < 0) {
      return {
        field: "filesizeBytes",
        message: "filesizeBytes debe ser un entero mayor o igual a 0.",
      };
    }
  }

  return null;
}

export async function getPendingCameraIngestJobs(
  limit = 20
): Promise<CameraIngestJob[]> {
  assertCameraIngestPrismaReady();
  const now = new Date();

  return prisma.cameraIngestJob.findMany({
    where: {
      status: "PENDING",
      OR: [{ runAfter: null }, { runAfter: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function getCameraIngestJobById(
  id: string
): Promise<CameraIngestJob | null> {
  assertCameraIngestPrismaReady();
  return prisma.cameraIngestJob.findUnique({ where: { id } });
}

export async function markCameraIngestJobCompleted(
  id: string,
  photoId: number
): Promise<CameraIngestJob> {
  assertCameraIngestPrismaReady();
  if (!isPositiveInt(photoId)) {
    throw new Error("photoId debe ser un entero positivo.");
  }

  const now = new Date();
  return prisma.cameraIngestJob.update({
    where: { id },
    data: {
      status: "COMPLETED",
      photoId,
      completedAt: now,
      lockedAt: null,
      lastError: null,
    },
  });
}

export async function markCameraIngestJobFailed(
  id: string,
  errorMessage: string
): Promise<CameraIngestJob> {
  assertCameraIngestPrismaReady();
  const message = truncateError(errorMessage.trim() || "Error desconocido");

  return prisma.cameraIngestJob.update({
    where: { id },
    data: {
      status: "FAILED",
      lastError: message,
      lockedAt: null,
    },
  });
}

export async function resetCameraIngestJobForRetry(
  id: string,
  errorMessage: string,
  runAfter?: Date | null
): Promise<CameraIngestJob> {
  assertCameraIngestPrismaReady();
  const message = truncateError(errorMessage.trim() || "Error desconocido");

  return prisma.cameraIngestJob.update({
    where: { id },
    data: {
      status: "PENDING",
      lastError: message,
      lockedAt: null,
      runAfter: runAfter ?? null,
    },
  });
}
