import { NextRequest, NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { logCronMetrics } from "@/lib/cron-metrics";
import { runExifDeviceScanJob } from "@/lib/photographic-equipment/run-exif-device-scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
}

/**
 * Cron de escaneo EXIF para equipos fotográficos (backfill + ventana diaria).
 *
 * - BACKFILL: procesa 24/7 en lotes hasta pendingCount=0.
 * - DAILY: solo entre 02:00 y 05:00 America/Argentina/Cordoba.
 *
 * Vercel Cron sugerido: cada 10 minutos (ver vercel.json; en DAILY el código filtra la ventana).
 */
async function handleCron(req: NextRequest) {
  const started = Date.now();

  if (!isVercelCron(req)) {
    const unauthorized = assertCronAuth(req);
    if (unauthorized) return unauthorized;
  }

  const result = await runExifDeviceScanJob({ holderPrefix: "cron" });

  logCronMetrics({
    cron: "process-photo-exif-devices",
    duration_ms: result.durationMs,
    jobs_claimed: result.processed,
    jobs_ok: result.analyzed,
    jobs_failed: result.failed,
    images_processed: result.processed,
    with_exif: result.analyzed,
    no_exif: result.noExif,
    idle: result.skipped,
    mode: result.mode,
    skipped_reason: result.skippedReason,
  });

  if (!result.skipped && result.processed > 0) {
    console.info("[exif-device-scan] batch complete", {
      mode: result.mode,
      processed: result.processed,
      analyzed: result.analyzed,
      noExif: result.noExif,
      failed: result.failed,
      pendingRemaining: result.pendingRemaining,
      durationMs: result.durationMs,
      isBackfillComplete: result.isBackfillComplete,
    });
  }

  return NextResponse.json({
    ok: result.ok,
    skipped: result.skipped,
    skippedReason: result.skippedReason,
    mode: result.mode,
    isBackfillComplete: result.isBackfillComplete,
    processed: result.processed,
    analyzed: result.analyzed,
    noExif: result.noExif,
    failed: result.failed,
    pendingRemaining: result.pendingRemaining,
    lockStatus: result.lockStatus,
    durationMs: result.durationMs,
    batchSize: result.batchSize,
    timezone: result.timezone,
    inWindow: result.inWindow,
    elapsedMs: Date.now() - started,
  });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
