import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PrismaClient } from "@repo/db";
import type { WorkerConfig } from "./config.js";
import {
  assertFfmpegAvailable,
  buildPreviewMp4,
  generateThumbnail,
  probeVideo,
} from "./ffmpeg.js";
import { getPrisma } from "./prisma.js";
import {
  downloadFromR2,
  previewKey,
  thumbnailKey,
  uploadFileToR2,
} from "./r2.js";
import { recoverStaleJobs } from "./recover-stale-jobs.js";

export type ClaimedJob = {
  id: string;
  videoId: number;
  attempts: number;
};

function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 500);
}

function backoffMs(attempts: number): number {
  const base = 60_000;
  return base * Math.max(1, attempts);
}

export async function claimNextJob(prisma: PrismaClient): Promise<ClaimedJob | null> {
  const now = new Date();
  const rows = await prisma.$queryRaw<
    Array<{ id: string; videoId: number; attempts: number }>
  >`
    WITH next_job AS (
      SELECT id
      FROM "VideoProcessingJob"
      WHERE status = 'PENDING'
        AND ("runAfter" IS NULL OR "runAfter" <= ${now})
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "VideoProcessingJob" AS j
    SET
      status = 'PROCESSING',
      "lockedAt" = ${now},
      attempts = j.attempts + 1,
      "updatedAt" = ${now}
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.id, j."videoId", j.attempts
  `;

  const row = rows[0];
  if (!row) return null;

  await prisma.videoAsset.update({
    where: { id: row.videoId },
    data: {
      processingStatus: "PROCESSING",
      processingError: null,
    },
  });

  return row;
}

async function markJobFailed(
  prisma: PrismaClient,
  job: ClaimedJob,
  message: string,
  maxAttempts: number
) {
  const exhausted = job.attempts >= maxAttempts;

  if (exhausted) {
    await prisma.$transaction([
      prisma.videoProcessingJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          lastError: message,
          lockedAt: null,
        },
      }),
      prisma.videoAsset.update({
        where: { id: job.videoId },
        data: {
          processingStatus: "FAILED",
          processingError: message,
        },
      }),
    ]);
    return;
  }

  const runAfter = new Date(Date.now() + backoffMs(job.attempts));
  await prisma.$transaction([
    prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        lastError: message,
        lockedAt: null,
        runAfter,
      },
    }),
    prisma.videoAsset.update({
      where: { id: job.videoId },
      data: {
        processingStatus: "UPLOADED",
        processingError: null,
      },
    }),
  ]);
}

async function markJobCompleted(
  prisma: PrismaClient,
  job: ClaimedJob,
  data: {
    albumId: number;
    thumbKey: string;
    prevKey: string;
    probe: Awaited<ReturnType<typeof probeVideo>>;
  }
) {
  const durationSeconds = Math.max(1, Math.round(data.probe.durationSeconds));

  await prisma.$transaction([
    prisma.videoAsset.update({
      where: { id: job.videoId },
      data: {
        processingStatus: "READY",
        processingError: null,
        thumbnailKey: data.thumbKey,
        previewKey: data.prevKey,
        durationSeconds,
        width: data.probe.width,
        height: data.probe.height,
        orientation: data.probe.orientation,
      },
    }),
    prisma.videoProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        lastError: null,
        lockedAt: null,
        runAfter: null,
      },
    }),
  ]);
}

export async function processClaimedJob(
  config: WorkerConfig,
  job: ClaimedJob
): Promise<{ ok: true } | { ok: false; error: string }> {
  const prisma = getPrisma();
  const maxAttempts = config.VIDEO_WORKER_MAX_ATTEMPTS;

  const video = await prisma.videoAsset.findUnique({
    where: { id: job.videoId },
    select: {
      id: true,
      albumId: true,
      originalKey: true,
      isRemoved: true,
    },
  });

  if (!video || video.isRemoved) {
    const msg = "Video no encontrado o eliminado";
    await markJobFailed(prisma, job, msg, maxAttempts);
    return { ok: false, error: msg };
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `clf-video-${video.id}-`));

  try {
    await assertFfmpegAvailable();

    const originalLocal = path.join(workDir, "original");
    await downloadFromR2(config, video.originalKey, originalLocal);

    const probe = await probeVideo(originalLocal);

    const scaleOpts = {
      videoId: video.id,
      orientation: probe.orientation,
      rotationDegrees: probe.rotationDegrees,
    };

    const thumbLocal = path.join(workDir, "thumb.jpg");
    await generateThumbnail(originalLocal, thumbLocal, probe.durationSeconds, scaleOpts);

    const previewLocal = await buildPreviewMp4(
      originalLocal,
      workDir,
      probe.durationSeconds,
      video.id,
      scaleOpts
    );

    const thumbR2 = thumbnailKey(video.albumId, video.id);
    const prevR2 = previewKey(video.albumId, video.id);

    await uploadFileToR2(config, thumbLocal, thumbR2, "image/jpeg");
    await uploadFileToR2(config, previewLocal, prevR2, "video/mp4");

    await markJobCompleted(prisma, job, {
      albumId: video.albumId,
      thumbKey: thumbR2,
      prevKey: prevR2,
      probe,
    });

    console.info("[video-worker] completed", {
      jobId: job.id,
      videoId: video.id,
      albumId: video.albumId,
      durationSeconds: probe.durationSeconds,
    });

    return { ok: true };
  } catch (err) {
    const msg = shortError(err);
    console.error("[video-worker] job failed", {
      jobId: job.id,
      videoId: job.videoId,
      attempts: job.attempts,
      error: msg,
    });
    await markJobFailed(prisma, job, msg, maxAttempts);
    return { ok: false, error: msg };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function runProcessOnce(config: WorkerConfig): Promise<boolean> {
  const prisma = getPrisma();

  const recovery = await recoverStaleJobs(prisma, config);
  if (recovery.recovered > 0 || recovery.failed > 0) {
    console.info("[video-worker] stale job recovery", recovery);
  }

  const job = await claimNextJob(prisma);
  if (!job) {
    console.info("[video-worker] no pending jobs");
    return false;
  }

  console.info("[video-worker] claimed job", job);
  await processClaimedJob(config, job);
  return true;
}
