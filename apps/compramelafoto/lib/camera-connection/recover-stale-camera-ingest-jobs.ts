import type { PrismaClient } from "@/lib/prisma";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";
import type { CameraIngestRunConfig } from "@/lib/camera-connection/camera-ingest-run-config";

const RECOVERED_ERROR = "Recovered stale processing job";
const EXPIRED_ERROR = "Camera ingest job expired while processing";

function shortError(message: string): string {
  return message.slice(0, 500);
}

/**
 * Reencola o falla jobs PROCESSING cuyo lock expiró (worker caído a mitad de proceso).
 */
export async function recoverStaleCameraIngestJobs(
  prisma: PrismaClient,
  config: CameraIngestRunConfig
): Promise<{ recovered: number; failed: number }> {
  const maxAttempts = config.CAMERA_INGEST_MAX_ATTEMPTS;
  const staleMs = config.CAMERA_INGEST_STALE_MINUTES * 60 * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  const now = new Date();

  const stale = await prisma.cameraIngestJob.findMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: cutoff },
    },
    select: {
      id: true,
      attempts: true,
      uploadLogId: true,
    },
  });

  let recovered = 0;
  let failed = 0;

  for (const job of stale) {
    if (job.attempts >= maxAttempts) {
      await prisma.$transaction([
        prisma.cameraIngestJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            lastError: EXPIRED_ERROR,
            lockedAt: null,
            runAfter: null,
          },
        }),
        ...(job.uploadLogId != null
          ? [
              prisma.cameraUploadLog.update({
                where: { id: job.uploadLogId },
                data: {
                  status: CAMERA_UPLOAD_LOG_STATUS.FAILED,
                  errorMessage: shortError(EXPIRED_ERROR),
                },
              }),
            ]
          : []),
      ]);
      failed += 1;
    } else {
      await prisma.$transaction([
        prisma.cameraIngestJob.update({
          where: { id: job.id },
          data: {
            status: "PENDING",
            lastError: RECOVERED_ERROR,
            lockedAt: null,
            runAfter: now,
          },
        }),
        ...(job.uploadLogId != null
          ? [
              prisma.cameraUploadLog.update({
                where: { id: job.uploadLogId },
                data: {
                  status: CAMERA_UPLOAD_LOG_STATUS.RECEIVED,
                  errorMessage: null,
                },
              }),
            ]
          : []),
      ]);
      recovered += 1;
    }
  }

  return { recovered, failed };
}
