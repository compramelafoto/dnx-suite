/**
 * GET /api/zip-jobs/[id]/download
 * Redirige a una URL firmada nueva (24h) para descargar el ZIP.
 * Útil para que enlaces en admin o emails no fallen por URL caducada.
 */
import { NextRequest, NextResponse } from "next/server";
import { getJobStatus } from "@/lib/zip-job-queue";
import { getSignedUrlForFile } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } | Promise<{ id: string }> }
) {
  const params = await Promise.resolve(ctx.params);
  const jobId = params.id;
  if (!jobId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const job = await getJobStatus(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
  }
  if (job.status !== "COMPLETED" || !job.r2Key) {
    return NextResponse.json(
      { error: "El ZIP aún no está listo o no existe." },
      { status: 404 }
    );
  }

  try {
    const url = await getSignedUrlForFile(job.r2Key, 24 * 60 * 60);
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("[zip-jobs/download] Error generando URL firmada:", e);
    return NextResponse.json(
      { error: "No se pudo generar el enlace de descarga." },
      { status: 500 }
    );
  }
}
