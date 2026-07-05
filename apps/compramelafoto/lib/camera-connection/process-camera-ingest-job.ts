import type { PrismaClient } from "@/lib/prisma";
import { finalizeAlbumPhotoFromRaw } from "@/lib/albums/finalize-album-photo-from-raw";
import {
  getAlbumPhotoMaxBytes,
  getAlbumPhotoMaxMb,
} from "@/lib/albums/album-photo-upload-limits";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";
import type { CameraIngestRunConfig } from "@/lib/camera-connection/camera-ingest-run-config";
import {
  claimNextCameraIngestJob,
  type ClaimedCameraIngestJob,
} from "@/lib/camera-connection/claim-camera-ingest-job";
import { recoverStaleCameraIngestJobs } from "@/lib/camera-connection/recover-stale-camera-ingest-jobs";
import { prisma } from "@/lib/prisma";

const LAST_ERROR_MAX_LENGTH = 500;

function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, LAST_ERROR_MAX_LENGTH);
}

function backoffMs(attempts: number): number {
  const base = 60_000;
  return base * Math.max(1, attempts);
}

/** Errores que no tienen sentido reintentar. */
export function isNonRetryableCameraIngestError(message: string): boolean {
  if (message === "Key inválida") return true;
  if (/supera el límite de \d+MB/i.test(message)) return true;
  if (/unsupported image format|Input buffer contains|not an image/i.test(message)) {
    return true;
  }
  if (/NoSuchKey|NotFound|The specified key does not exist/i.test(message)) {
    return true;
  }
  return false;
}

function assertRawKeyForAlbum(rawKey: string, albumId: number): void {
  const expectedPrefix = `albums/${albumId}/raw/`;
  if (!rawKey.startsWith(expectedPrefix)) {
    throw new Error("Key inválida");
  }
}

async function markUploadLogProcessing(
  client: PrismaClient,
  uploadLogId: number | null
): Promise<void> {
  if (uploadLogId == null) return;

  await client.cameraUploadLog.update({
    where: { id: uploadLogId },
    data: {
      status: CAMERA_UPLOAD_LOG_STATUS.PROCESSING,
      errorMessage: null,
    },
  });
}

async function markJobCompleted(
  client: PrismaClient,
  job: ClaimedCameraIngestJob,
  photoId: number
): Promise<void> {
  const now = new Date();

  await client.$transaction([
    client.cameraIngestJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        photoId,
        completedAt: now,
        lockedAt: null,
        lastError: null,
        runAfter: null,
      },
    }),
    ...(job.uploadLogId != null
      ? [
          client.cameraUploadLog.update({
            where: { id: job.uploadLogId },
            data: {
              status: CAMERA_UPLOAD_LOG_STATUS.SUCCESS,
              errorMessage: null,
            },
          }),
        ]
      : []),
    client.cameraConnectionSettings.updateMany({
      where: { userId: job.userId },
      data: { lastUploadAt: now },
    }),
  ]);
}

async function markJobRetryable(
  client: PrismaClient,
  job: ClaimedCameraIngestJob,
  message: string
): Promise<void> {
  const runAfter = new Date(Date.now() + backoffMs(job.attempts));

  await client.$transaction([
    client.cameraIngestJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        lastError: message,
        lockedAt: null,
        runAfter,
      },
    }),
    ...(job.uploadLogId != null
      ? [
          client.cameraUploadLog.update({
            where: { id: job.uploadLogId },
            data: {
              status: CAMERA_UPLOAD_LOG_STATUS.RECEIVED,
              errorMessage: message,
            },
          }),
        ]
      : []),
  ]);
}

async function markJobFailed(
  client: PrismaClient,
  job: ClaimedCameraIngestJob,
  message: string
): Promise<void> {
  await client.$transaction([
    client.cameraIngestJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        lastError: message,
        lockedAt: null,
        runAfter: null,
      },
    }),
    ...(job.uploadLogId != null
      ? [
          client.cameraUploadLog.update({
            where: { id: job.uploadLogId },
            data: {
              status: CAMERA_UPLOAD_LOG_STATUS.FAILED,
              errorMessage: message,
            },
          }),
        ]
      : []),
  ]);
}

async function handleJobFailure(
  client: PrismaClient,
  job: ClaimedCameraIngestJob,
  message: string,
  maxAttempts: number
): Promise<void> {
  const exhausted = job.attempts >= maxAttempts;
  const nonRetryable = isNonRetryableCameraIngestError(message);

  if (exhausted || nonRetryable) {
    await markJobFailed(client, job, message);
    return;
  }

  await markJobRetryable(client, job, message);
}

export async function processClaimedCameraIngestJob(
  config: CameraIngestRunConfig,
  job: ClaimedCameraIngestJob,
  client: PrismaClient = prisma
): Promise<{ ok: true; photoId: number } | { ok: false; error: string }> {
  const maxAttempts = config.CAMERA_INGEST_MAX_ATTEMPTS;

  try {
    await markUploadLogProcessing(client, job.uploadLogId);
    assertRawKeyForAlbum(job.rawKey, job.albumId);

    const result = await finalizeAlbumPhotoFromRaw({
      albumId: job.albumId,
      userId: job.userId,
      key: job.rawKey,
      eventFolderId: job.eventFolderId ?? undefined,
      folderId: job.folderId ?? undefined,
      maxBytes: getAlbumPhotoMaxBytes(),
      maxMb: getAlbumPhotoMaxMb(),
    });

    await markJobCompleted(client, job, result.photo.id);

    return { ok: true, photoId: result.photo.id };
  } catch (err) {
    const msg = shortError(err);
    await handleJobFailure(client, job, msg, maxAttempts);
    return { ok: false, error: msg };
  }
}

export type CameraIngestBatchResult = {
  recovery: { recovered: number; failed: number };
  claimed: number;
  completed: number;
  failed: number;
  results: Array<{ jobId: string; ok: boolean; photoId?: number; error?: string }>;
};

export type CameraIngestDrainResult = {
  batches: number;
  totalClaimed: number;
  totalCompleted: number;
  totalFailed: number;
  elapsedMs: number;
  stoppedReason: "empty" | "time_budget" | "max_batches";
  lastBatch: CameraIngestBatchResult | null;
};

/**
 * Recupera jobs viejos, toma hasta N jobs PENDING y los procesa en paralelo.
 */
export async function runCameraIngestBatch(
  config: CameraIngestRunConfig,
  client: PrismaClient = prisma,
  options?: { skipRecovery?: boolean }
): Promise<CameraIngestBatchResult> {
  const recovery = options?.skipRecovery
    ? { recovered: 0, failed: 0 }
    : await recoverStaleCameraIngestJobs(client, config);
  const concurrency = config.CAMERA_INGEST_BATCH_CONCURRENCY;
  const claimed: ClaimedCameraIngestJob[] = [];

  for (let i = 0; i < concurrency; i += 1) {
    const job = await claimNextCameraIngestJob(client);
    if (!job) break;
    claimed.push(job);
  }

  if (claimed.length === 0) {
    return {
      recovery,
      claimed: 0,
      completed: 0,
      failed: 0,
      results: [],
    };
  }

  const settled = await Promise.all(
    claimed.map(async (job) => {
      const result = await processClaimedCameraIngestJob(config, job, client);
      return { jobId: job.id, ...result };
    })
  );

  const results = settled.map((row) =>
    row.ok
      ? { jobId: row.jobId, ok: true as const, photoId: row.photoId }
      : { jobId: row.jobId, ok: false as const, error: row.error }
  );

  return {
    recovery,
    claimed: claimed.length,
    completed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}

/**
 * Ejecuta lotes seguidos hasta vaciar la cola o agotar tiempo / tope de lotes.
 * Usado por el cron de Vercel (5 min) y por el botón admin de drenaje.
 */
export async function runCameraIngestDrain(
  config: CameraIngestRunConfig,
  options: {
    maxDurationMs: number;
    maxBatches?: number;
    client?: PrismaClient;
  }
): Promise<CameraIngestDrainResult> {
  const client = options.client ?? prisma;
  const started = Date.now();
  const maxBatches = options.maxBatches ?? 200;
  let batches = 0;
  let totalClaimed = 0;
  let totalCompleted = 0;
  let totalFailed = 0;
  let lastBatch: CameraIngestBatchResult | null = null;
  let stoppedReason: CameraIngestDrainResult["stoppedReason"] = "empty";

  while (batches < maxBatches) {
    if (Date.now() - started >= options.maxDurationMs) {
      stoppedReason = "time_budget";
      break;
    }

    const batch = await runCameraIngestBatch(config, client, {
      skipRecovery: batches > 0,
    });
    lastBatch = batch;
    batches += 1;

    if (batch.claimed === 0) {
      stoppedReason = "empty";
      break;
    }

    totalClaimed += batch.claimed;
    totalCompleted += batch.completed;
    totalFailed += batch.failed;
  }

  if (
    stoppedReason !== "time_budget" &&
    totalClaimed > 0 &&
    lastBatch &&
    lastBatch.claimed > 0 &&
    batches >= maxBatches
  ) {
    stoppedReason = "max_batches";
  }

  return {
    batches,
    totalClaimed,
    totalCompleted,
    totalFailed,
    elapsedMs: Date.now() - started,
    stoppedReason,
    lastBatch,
  };
}
