import { NextRequest, NextResponse } from "next/server";
import { countPendingZipJobs, getJobStatus, getNextPendingJobs } from "@/lib/zip-job-queue";
import { generateZipForJob } from "@/lib/zip-generation";
import { assertCronAuth } from "@/lib/cron-auth";
import { logCronMetrics } from "@/lib/cron-metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Una sola generación ZIP por tick de cron (Fase 1 costos). */
const MAX_JOBS_PER_RUN = 1;

async function runProcessZipJobs() {
  const started = Date.now();
  const pendingCount = await countPendingZipJobs();

  if (pendingCount === 0) {
    logCronMetrics({
      cron: "process-zip-jobs",
      duration_ms: Date.now() - started,
      jobs_claimed: 0,
      jobs_ok: 0,
      jobs_failed: 0,
      images_processed: 0,
      idle: true,
    });
    return NextResponse.json({
      ok: true,
      idle: true,
      processed: 0,
      pending: 0,
      jobIds: [],
      failed: [],
    });
  }

  const jobs = await getNextPendingJobs(MAX_JOBS_PER_RUN);
  const processed: string[] = [];
  const failed: string[] = [];
  let imagesProcessed = 0;
  const finalStatuses: string[] = [];

  for (const job of jobs) {
    if (job.status !== "PENDING") {
      continue;
    }

    const photoCount = Array.isArray(job.photoIds) ? job.photoIds.length : job.totalItems ?? 0;
    try {
      await generateZipForJob(job.id);
      processed.push(job.id);
      imagesProcessed += photoCount;

      const finalJob = await getJobStatus(job.id);
      finalStatuses.push(finalJob?.status ?? "UNKNOWN");
    } catch (error: unknown) {
      console.error("Error procesando zip job:", job.id, error);
      failed.push(job.id);
      const finalJob = await getJobStatus(job.id);
      finalStatuses.push(finalJob?.status ?? "FAILED");
    }
  }

  const durationMs = Date.now() - started;
  logCronMetrics({
    cron: "process-zip-jobs",
    duration_ms: durationMs,
    jobs_claimed: jobs.length,
    jobs_ok: processed.length,
    jobs_failed: failed.length,
    images_processed: imagesProcessed,
    idle: false,
    final_statuses: finalStatuses,
  });

  return NextResponse.json({
    ok: true,
    idle: false,
    processed: processed.length,
    pending: pendingCount,
    jobIds: processed,
    failed,
    imagesProcessed,
    durationMs,
  });
}

/** GET: usado por Vercel Cron (envía GET por defecto). */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return runProcessZipJobs();
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return runProcessZipJobs();
}
