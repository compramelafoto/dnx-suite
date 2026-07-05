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

/** @deprecated Usar /api/cron/process-photo-exif-devices */
async function handleLegacyCron(req: NextRequest) {
  if (!isVercelCron(req)) {
    const unauthorized = assertCronAuth(req);
    if (unauthorized) return unauthorized;
  }

  const result = await runExifDeviceScanJob({ holderPrefix: "cron-legacy" });

  logCronMetrics({
    cron: "process-exif-device-scan",
    duration_ms: result.durationMs,
    jobs_claimed: result.processed,
    jobs_ok: result.analyzed,
    jobs_failed: result.failed,
    images_processed: result.processed,
    with_exif: result.analyzed,
    no_exif: result.noExif,
    idle: result.skipped,
  });

  return NextResponse.json({ ...result });
}

export async function GET(req: NextRequest) {
  return handleLegacyCron(req);
}

export async function POST(req: NextRequest) {
  return handleLegacyCron(req);
}
