import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEditorDataJson, updateDesignRevisionDataJson } from "@/lib/school-render/design-editor";
import { Role } from "@/lib/prisma";

const requestSchema = z.object({
  revisionId: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const project = await prisma.designProject.findFirst({
    where: { id: projectId },
    include: {
      orderItem: {
        select: { order: { select: { album: { select: { userId: true } } } } },
      },
      revisions: {
        orderBy: { id: "desc" },
        take: 1,
      },
    },
  });
  if (!project || !project.revisions[0]) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const revision =
    parsed.data.revisionId != null
      ? await prisma.designRevision.findFirst({
          where: { id: parsed.data.revisionId, designProjectId: project.id },
        })
      : project.revisions[0];

  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  console.info("[school_design_export] export_requested", {
    projectId: project.id,
    revisionId: revision.id,
  });

  const dataJson = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: project.templateId ?? null,
    orderItemId: project.orderItemId ?? null,
  });
  const previewStatus = dataJson.previewStatus ?? "DIRTY";
  if (project.status !== "APPROVED_FOR_EXPORT") {
    console.info("[school_design_export] export_blocked_invalid_state", {
      projectId: project.id,
      status: project.status,
    });
    return NextResponse.json({ error: "Project not approved" }, { status: 409 });
  }
  if (dataJson.previewDirty || previewStatus !== "READY") {
    console.info("[school_design_export] export_blocked_invalid_state", {
      projectId: project.id,
      previewDirty: dataJson.previewDirty,
      previewStatus,
    });
    return NextResponse.json({ error: "Preview not ready" }, { status: 409 });
  }
  if (dataJson.exportStatus === "EXPORTING") {
    console.info("[school_design_export] export_blocked_invalid_state", {
      projectId: project.id,
      exportStatus: dataJson.exportStatus,
    });
    return NextResponse.json({ error: "Export in progress" }, { status: 409 });
  }

  const existingJob = await prisma.designExportJob.findFirst({
    where: {
      designRevisionId: revision.id,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (existingJob) {
    console.info("[school_design_export] export_job_deduplicated", {
      projectId: project.id,
      revisionId: revision.id,
      jobId: existingJob.id,
    });
    return NextResponse.json({ ok: true, deduped: true });
  }

  await prisma.$transaction(async (tx) => {
    await tx.designExportJob.create({
      data: {
        designProjectId: project.id,
        designRevisionId: revision.id,
        status: "PENDING",
      },
    });
    await tx.designProject.update({
      where: { id: project.id },
      data: { status: "EXPORTING" },
    });
    await updateDesignRevisionDataJson(
      revision.id,
      {
        ...dataJson,
        exportStatus: "EXPORTING",
        exportError: null,
      },
      tx
    );
  });

  console.info("[school_design_export] export_status_exporting", {
    projectId: project.id,
    revisionId: revision.id,
  });
  console.info("[school_design_export] export_job_enqueued", {
    projectId: project.id,
    revisionId: revision.id,
  });

  return NextResponse.json({ ok: true });
}
