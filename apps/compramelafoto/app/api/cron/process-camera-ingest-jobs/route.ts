import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { getCameraIngestRunConfigFromEnv } from "@/lib/camera-connection/camera-ingest-run-config";
import { runCameraIngestDrain } from "@/lib/camera-connection/process-camera-ingest-job";
import {
  CRON_LOCK_IDS,
  releaseCronLock,
  tryAcquireCronLock,
} from "@/lib/cron-advisory-lock";
import { logCronMetrics } from "@/lib/cron-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
}

function resolveDrainMaxDurationMs(): number {
  const raw = process.env.CAMERA_INGEST_CRON_MAX_DURATION_MS;
  if (raw != null && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return Math.min(n, 110_000);
    }
  }
  return 55_000;
}

/**
 * GET /api/cron/process-camera-ingest-jobs
 *
 * Drena la cola CameraIngestJob en lotes (~55 s por tick; cron cada 5 min).
 * Un solo drain activo por advisory lock en PostgreSQL.
 */
export async function GET(req: NextRequest) {
  if (!isVercelCron(req)) {
    const unauthorized = assertCronAuth(req);
    if (unauthorized) return unauthorized;
  }

  const started = Date.now();
  const lockAcquired = await tryAcquireCronLock(CRON_LOCK_IDS.CAMERA_INGEST);

  if (!lockAcquired) {
    logCronMetrics({
      cron: "process-camera-ingest-jobs",
      duration_ms: Date.now() - started,
      jobs_claimed: 0,
      jobs_ok: 0,
      jobs_failed: 0,
      images_processed: 0,
      skipped: true,
      idle: true,
    });
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "another_drain_active",
    });
  }

  try {
    const config = getCameraIngestRunConfigFromEnv();
    const result = await runCameraIngestDrain(config, {
      maxDurationMs: resolveDrainMaxDurationMs(),
      maxBatches: 50,
    });

    const imagesProcessed = result.totalCompleted;
    const durationMs = Date.now() - started;

    logCronMetrics({
      cron: "process-camera-ingest-jobs",
      duration_ms: durationMs,
      jobs_claimed: result.totalClaimed,
      jobs_ok: result.totalCompleted,
      jobs_failed: result.totalFailed,
      images_processed: imagesProcessed,
      skipped: false,
      idle: result.totalClaimed === 0,
      batches: result.batches,
      stopped_reason: result.stoppedReason,
    });

    console.info("[cron:process-camera-ingest-jobs]", result);
    return NextResponse.json({ ok: true, skipped: false, ...result });
  } finally {
    await releaseCronLock(CRON_LOCK_IDS.CAMERA_INGEST);
  }
}
