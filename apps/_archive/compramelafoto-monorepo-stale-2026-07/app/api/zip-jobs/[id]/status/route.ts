import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/zip-job-queue";
import { getSignedUrlForFile } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Para jobs COMPLETED con r2Key, genera una URL firmada nueva (24h) para evitar enlaces expirados o "no encontrado". */
async function getFreshZipUrlIfPossible(
  status: string,
  r2Key: string | null,
  existingZipUrl: string | null
): Promise<string | null> {
  if (status !== "COMPLETED" || !r2Key) return existingZipUrl ?? null;
  try {
    return await getSignedUrlForFile(r2Key, 24 * 60 * 60);
  } catch (e) {
    console.warn("[zip-jobs/status] No se pudo generar URL firmada para r2Key:", r2Key, e);
    return existingZipUrl ?? null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(ctx.params);
    const jobId = params.id;
    if (!jobId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const job = await getJobStatus(jobId);
    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    const zipUrl =
      job.status === "COMPLETED" && job.r2Key
        ? await getFreshZipUrlIfPossible(job.status, job.r2Key, job.zipUrl)
        : job.zipUrl;

    return NextResponse.json({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      processedItems: job.processedItems,
      totalItems: job.totalItems,
      zipUrl,
      error: job.error,
      expiresAt: job.expiresAt,
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error";
    console.error("zip-jobs/status error:", error);
    return NextResponse.json({ error: String(message) }, { status: 500 });
  }
}
