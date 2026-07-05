import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { loadDesignProjectEditorContext, normalizeEditorDataJson, updateDesignRevisionDataJson } from "@/lib/school-render/design-editor";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const revisionId = parseInt(id, 10);
  if (!Number.isFinite(revisionId) || revisionId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const revision = await prisma.designRevision.findUnique({
    where: { id: revisionId },
    select: { id: true, designProjectId: true, dataJson: true },
  });
  if (!revision) {
    return NextResponse.json({ error: "Revisión no encontrada" }, { status: 404 });
  }

  const ctx = await loadDesignProjectEditorContext(revision.designProjectId);
  if (!ctx) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (ctx.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  console.info("[school_design_preview_job] job_enqueued", {
    designProjectId: ctx.id,
    revisionId,
  });

  const data = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: ctx.templateId ?? null,
    orderItemId: ctx.orderItemId,
  });

  try {
    const existingJob = await prisma.designPreviewJob.findFirst({
      where: {
        designRevisionId: revision.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      select: { id: true, status: true },
    });
    if (existingJob) {
      console.info("[school_design_preview_job] job_deduplicated", {
        designProjectId: ctx.id,
        revisionId,
        jobId: existingJob.id,
        status: existingJob.status,
      });
      return NextResponse.json({ ok: true, status: existingJob.status });
    }

    data.previewStatus = "RENDERING";
    data.previewError = null;
    data.previewDirty = false;
    await updateDesignRevisionDataJson(revision.id, data);
    console.info("[school_design_preview_job] preview_status_rendering", {
      designProjectId: ctx.id,
      revisionId,
    });

    const job = await prisma.designPreviewJob.create({
      data: { designRevisionId: revision.id },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, jobId: job.id, status: "PENDING" });
  } catch (err) {
    console.error("[school_design_preview_job] job_failed", err);
    return NextResponse.json({ error: "No se pudo regenerar la preview" }, { status: 500 });
  }
}
