import { NextRequest, NextResponse } from "next/server";
import { generateZipForJob } from "@/lib/zip-generation";
import { markFailed, getJobStatus } from "@/lib/zip-job-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySecret(req: NextRequest) {
  const secretHeader = req.headers.get("x-zip-secret");
  const url = new URL(req.url);
  const secretQuery = url.searchParams.get("zipSecret");
  const secret = secretHeader || secretQuery;
  if (!secret || secret !== process.env.ZIP_JOB_PROCESS_SECRET) {
    return NextResponse.json({ error: "Secret inválido" }, { status: 401 });
  }
  return null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  let jobId: string | undefined;
  try {
    const unauthorized = verifySecret(req);
    if (unauthorized) return unauthorized;

    const params = await Promise.resolve(ctx.params);
    jobId = params.id;
    if (!jobId) {
      return NextResponse.json({ error: "ID de job requerido" }, { status: 400 });
    }

    const currentJob = await getJobStatus(jobId);
    if (!currentJob) {
      return NextResponse.json(
        { error: `Zip job ${jobId} no encontrado` },
        { status: 404 }
      );
    }

    const processingTimeoutMs = Number(
      process.env.ZIP_JOB_PROCESS_TIMEOUT_MS ?? 15 * 60 * 1000
    );
    if (
      currentJob.status === "PROCESSING" &&
      currentJob.startedAt &&
      Date.now() - currentJob.startedAt.getTime() > processingTimeoutMs
    ) {
      console.warn(`[ZIP] job ${jobId} procesando por mucho tiempo, marcando failed`);
      await markFailed(jobId, "timeout");
      const finalJob = await getJobStatus(jobId);
      return NextResponse.json({
        success: false,
        job: finalJob,
        error: "timeout",
      });
    }

    if (currentJob.status !== "PENDING") {
      return NextResponse.json({
        success: true,
        job: currentJob,
      });
    }

    await generateZipForJob(jobId);
    const job = await getJobStatus(jobId);
    return NextResponse.json({
      success: job?.status === "COMPLETED",
      job,
    });
  } catch (error: any) {
    console.error("Error procesando zip job:", error);
    const params = await Promise.resolve(ctx.params);
    const jobId = params.id;
    const finalJob = jobId ? await getJobStatus(jobId) : null;
    return NextResponse.json(
      { error: String(error.message || error), job: finalJob },
      { status: 500 }
    );
  }
}
