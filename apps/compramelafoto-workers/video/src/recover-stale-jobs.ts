import type { PrismaClient } from "@repo/db";
import type { WorkerConfig } from "./config.js";

const RECOVERED_ERROR = "Recovered stale processing job";
const EXPIRED_ERROR = "Video processing job expired while processing";

/**
 * Reencola jobs PROCESSING cuyo lock expiró (worker caído a mitad de proceso).
 * Debe ejecutarse antes de reclamar un job PENDING.
 */
export async function recoverStaleJobs(
  prisma: PrismaClient,
  config: WorkerConfig
): Promise<{ recovered: number; failed: number }> {
  const maxAttempts = config.VIDEO_WORKER_MAX_ATTEMPTS;
  const staleMs = config.VIDEO_WORKER_STALE_JOB_MINUTES * 60 * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  const now = new Date();

  const stale = await prisma.videoProcessingJob.findMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: cutoff },
    },
    select: {
      id: true,
      videoId: true,
      attempts: true,
    },
  });

  let recovered = 0;
  let failed = 0;

  for (const job of stale) {
    if (job.attempts >= maxAttempts) {
      await prisma.$transaction([
        prisma.videoProcessingJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            lastError: EXPIRED_ERROR,
            lockedAt: null,
            runAfter: null,
          },
        }),
        prisma.videoAsset.update({
          where: { id: job.videoId },
          data: {
            processingStatus: "FAILED",
            processingError: EXPIRED_ERROR,
          },
        }),
      ]);
      failed += 1;
      console.info("[video-worker] failed stale job", {
        jobId: job.id,
        videoId: job.videoId,
        attempts: job.attempts,
        lockedBefore: cutoff.toISOString(),
      });
    } else {
      await prisma.$transaction([
        prisma.videoProcessingJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            lastError: RECOVERED_ERROR,
            lockedAt: null,
            runAfter: now,
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
      recovered += 1;
      console.info("[video-worker] recovered stale job", {
        jobId: job.id,
        videoId: job.videoId,
        attempts: job.attempts,
        lockedBefore: cutoff.toISOString(),
      });
    }
  }

  return { recovered, failed };
}
