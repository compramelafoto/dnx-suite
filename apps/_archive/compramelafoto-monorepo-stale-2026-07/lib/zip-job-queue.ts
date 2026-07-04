import { prisma } from "@/lib/prisma";
import type { InputJsonValue } from "@prisma/client/runtime/library";

type JsonMeta = Exclude<InputJsonValue, null>;

/** Días que se mantienen disponibles los ZIPs (link y validez del recurso). */
export const ZIP_RETENTION_DAYS = 7;

export function getZipExpiresAt(): Date {
  return new Date(Date.now() + ZIP_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export type ZipJobType = "ORDER_DOWNLOAD" | "ALBUM_DOWNLOAD" | "CUSTOM_PHOTOS";

type CreateZipJobParams = {
  type: ZipJobType;
  orderId?: number | null;
  albumId?: number | null;
  requesterUserId?: number | null;
  photoIds: number[];
  meta?: JsonMeta;
  expiresAt?: Date | null;
};

export async function createZipJob(params: CreateZipJobParams) {
  const data: {
    type: ZipJobType;
    orderId?: number | null;
    albumId?: number | null;
    requesterUserId?: number | null;
    photoIds: number[];
    totalItems: number;
    meta?: InputJsonValue;
    expiresAt?: Date | null;
  } = {
    type: params.type,
    orderId: params.orderId ?? null,
    albumId: params.albumId ?? null,
    requesterUserId: params.requesterUserId ?? null,
    photoIds: params.photoIds,
    totalItems: params.photoIds.length,
  };

  if (params.meta != null) {
    data.meta = params.meta;
  }
  if (params.expiresAt) {
    data.expiresAt = params.expiresAt;
  }

  const job = await prisma.zipGenerationJob.create({
    data,
  });
  return job;
}

export async function getNextPendingJobs(limit = 5) {
  return prisma.zipGenerationJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function markProcessing(jobId: string) {
  return prisma.zipGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
    },
  });
}

export async function updateProgress(jobId: string, processedItems: number, totalItems: number) {
  const progress =
  totalItems > 0
  ? Math.min(99, Math.floor((processedItems / totalItems) * 100))
  : 0;
  return prisma.zipGenerationJob.update({
    where: { id: jobId },
    data: {
      processedItems,
      totalItems,
      progress,
    },
  });
}

export async function markCompleted(
  jobId: string,
  params: { r2Key: string; zipUrl: string; expiresAt?: Date | null }
) {
  return prisma.zipGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      r2Key: params.r2Key,
      zipUrl: params.zipUrl,
      expiresAt: params.expiresAt ?? null,
      finishedAt: new Date(),
      progress: 100,
    },
  });
}

export async function markFailed(jobId: string, errorMessage: string) {
  console.error(`ZIP JOB ${jobId}: marca como failed -> ${errorMessage}`);
  return prisma.zipGenerationJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      error: errorMessage,
      finishedAt: new Date(),
      progress: 0,
    },
  });
}

export async function getJobStatus(jobId: string) {
  return prisma.zipGenerationJob.findUnique({
    where: { id: jobId },
  });
}
