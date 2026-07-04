import { NextRequest, NextResponse } from "next/server";
import { getNextPendingJobs } from "@/lib/zip-job-queue";
import { generateZipForJob } from "@/lib/zip-generation";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function runProcessZipJobs(req: NextRequest) {
  const jobs = await getNextPendingJobs(5);
  const processed: string[] = [];
  const failed: string[] = [];

  for (const job of jobs) {
    try {
      await generateZipForJob(job.id);
      processed.push(job.id);
    } catch (error: any) {
      console.error("Error procesando zip job:", job.id, error);
      failed.push(job.id);
    }
  }

  return NextResponse.json({
    processed: processed.length,
    jobIds: processed,
    failed,
  });
}

/** GET: usado por Vercel Cron (envía GET por defecto). */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return runProcessZipJobs(req);
}

export async function POST(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  return runProcessZipJobs(req);
}
