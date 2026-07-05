import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role, CameraIngestJobStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { ensureAlbumUploadAccess } from "../photos/upload-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARSE_STATUSES = new Set<string>([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

/**
 * GET /api/dashboard/albums/[id]/ingest-jobs?status=PENDING,PROCESSING
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok && user.role !== Role.ADMIN) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const statusParam = req.nextUrl.searchParams.get("status")?.trim();
    const statuses = statusParam
      ? statusParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s) => PARSE_STATUSES.has(s)) as CameraIngestJobStatus[]
      : (["PENDING", "PROCESSING", "FAILED"] as CameraIngestJobStatus[]);

    const jobs = await prisma.cameraIngestJob.findMany({
      where: {
        albumId,
        ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        status: true,
        source: true,
        rawKey: true,
        originalFilename: true,
        filesizeBytes: true,
        photoId: true,
        lastError: true,
        attempts: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        eventFolderId: true,
        folderId: true,
      },
    });

    const summary = {
      pending: jobs.filter((j) => j.status === "PENDING").length,
      processing: jobs.filter((j) => j.status === "PROCESSING").length,
      failed: jobs.filter((j) => j.status === "FAILED").length,
    };

    return NextResponse.json({ jobs, summary });
  } catch (err: unknown) {
    console.error("GET ingest-jobs ERROR >>>", err);
    return NextResponse.json(
      { error: String((err as { message?: string })?.message ?? err) },
      { status: 500 }
    );
  }
}
