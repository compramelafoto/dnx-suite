import { NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analysis/analysis-runner";
import { resolveIncludeOcrFromRequest } from "@/lib/analysis/resolve-include-ocr";
import {
  CRON_LOCK_IDS,
  releaseCronLock,
  tryAcquireCronLock,
} from "@/lib/cron-advisory-lock";
import { logCronMetrics } from "@/lib/cron-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

/**
 * OCR: `?ocr=1` en vercel.json fuerza Vision en cada foto del lote.
 * Conviene separar en un cron dedicado (p. ej. cada 30–60 min) cuando exista photo-worker;
 * por ahora se mantiene el mismo endpoint para no romper el pipeline escolar/eventos.
 */
async function runAnalysis(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const started = Date.now();
  const lockAcquired = await tryAcquireCronLock(CRON_LOCK_IDS.ANALYSIS);

  if (!lockAcquired) {
    logCronMetrics({
      cron: "internal/analysis/run",
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
      reason: "another_analysis_active",
    });
  }

  try {
    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";
    const includeOcr = resolveIncludeOcrFromRequest(url);
    const response = await runAnalysisPipeline({ includeOcr, debug, source: "cron" });

    if (response instanceof NextResponse) {
      const body = await response.clone().json().catch(() => ({}));
      const processed = typeof body.processed === "number" ? body.processed : 0;
      const failed =
        typeof body.processed_fail === "number" ? body.processed_fail : 0;
      const locked =
        typeof body.jobs_locked_real === "number" ? body.jobs_locked_real : 0;

      logCronMetrics({
        cron: "internal/analysis/run",
        duration_ms: Date.now() - started,
        jobs_claimed: locked,
        jobs_ok: processed,
        jobs_failed: failed,
        images_processed: processed,
        skipped: false,
        idle: locked === 0,
        include_ocr: includeOcr,
      });
    }

    return response;
  } finally {
    await releaseCronLock(CRON_LOCK_IDS.ANALYSIS);
  }
}

export async function POST(req: Request) {
  return runAnalysis(req);
}

export async function GET(req: Request) {
  return runAnalysis(req);
}
