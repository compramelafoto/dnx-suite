import type { WorkerConfig } from "./config.js";
import { getCameraIngestRunConfigFromEnv } from "@/lib/camera-connection/camera-ingest-run-config.js";
import {
  processClaimedCameraIngestJob,
  runCameraIngestBatch,
  type CameraIngestBatchResult,
} from "@/lib/camera-connection/process-camera-ingest-job.js";
import type { ClaimedCameraIngestJob } from "./claim-camera-ingest-job.js";

export { isNonRetryableCameraIngestError } from "@/lib/camera-connection/process-camera-ingest-job.js";

function toRunConfig(config: WorkerConfig) {
  return {
    CAMERA_INGEST_MAX_ATTEMPTS: config.CAMERA_INGEST_MAX_ATTEMPTS,
    CAMERA_INGEST_STALE_MINUTES: config.CAMERA_INGEST_STALE_MINUTES,
    CAMERA_INGEST_BATCH_CONCURRENCY: config.CAMERA_INGEST_BATCH_CONCURRENCY,
  };
}

export async function processClaimedCameraIngestJobWithConfig(
  config: WorkerConfig,
  job: ClaimedCameraIngestJob
): Promise<{ ok: true; photoId: number } | { ok: false; error: string }> {
  const result = await processClaimedCameraIngestJob(toRunConfig(config), job);
  if (result.ok) {
    console.info("[camera-ingest-worker] completed", {
      jobId: job.id,
      photoId: result.photoId,
      albumId: job.albumId,
      rawKey: job.rawKey,
    });
  } else {
    console.error("[camera-ingest-worker] job failed", {
      jobId: job.id,
      albumId: job.albumId,
      rawKey: job.rawKey,
      attempts: job.attempts,
      error: result.error,
    });
  }
  return result;
}

export async function runProcessOnce(config: WorkerConfig): Promise<boolean> {
  const summary: CameraIngestBatchResult = await runCameraIngestBatch(toRunConfig(config));

  if (summary.recovery.recovered > 0 || summary.recovery.failed > 0) {
    console.info("[camera-ingest-worker] stale job recovery", summary.recovery);
  }

  if (summary.claimed === 0) {
    console.info("[camera-ingest-worker] no pending jobs");
    return false;
  }

  console.info("[camera-ingest-worker] batch", {
    claimed: summary.claimed,
    completed: summary.completed,
    failed: summary.failed,
  });

  return true;
}

/** @deprecated Usar runProcessOnce; expuesto para tests locales. */
export function getDefaultRunConfigFromWorkerEnv() {
  return getCameraIngestRunConfigFromEnv();
}
