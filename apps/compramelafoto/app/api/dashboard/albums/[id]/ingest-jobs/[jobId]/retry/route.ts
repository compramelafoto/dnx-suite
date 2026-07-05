import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { ensureAlbumUploadAccess } from "../../../photos/upload-helpers";
import { resetCameraIngestJobForRetry } from "@/lib/camera-connection/camera-ingest-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dashboard/albums/[id]/ingest-jobs/[jobId]/retry
 */
export async function POST(
  _req: Request,
  ctx: {
    params: { id: string; jobId: string } | Promise<{ id: string; jobId: string }>;
  }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id, jobId } = await Promise.resolve(ctx.params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId) || !jobId?.trim()) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok && user.role !== Role.ADMIN) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const job = await prisma.cameraIngestJob.findFirst({
      where: { id: jobId, albumId },
    });

    if (!job) {
      return NextResponse.json({ error: "Job no encontrado" }, { status: 404 });
    }

    if (job.status !== "FAILED") {
      return NextResponse.json(
        { error: "Solo se pueden reintentar trabajos fallidos." },
        { status: 400 }
      );
    }

    const updated = await resetCameraIngestJobForRetry(jobId, "Reintento manual desde dashboard");

    return NextResponse.json({ job: updated });
  } catch (err: unknown) {
    console.error("POST ingest-jobs retry ERROR >>>", err);
    return NextResponse.json(
      { error: String((err as { message?: string })?.message ?? err) },
      { status: 500 }
    );
  }
}
