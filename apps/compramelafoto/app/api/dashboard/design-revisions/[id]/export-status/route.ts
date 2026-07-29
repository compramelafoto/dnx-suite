import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEditorDataJson } from "@/lib/school-render/design-editor";
import { Role } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const revisionId = Number(id);
  if (!Number.isFinite(revisionId)) {
    return NextResponse.json({ error: "Invalid revision id" }, { status: 400 });
  }

  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId },
    select: {
      id: true,
      dataJson: true,
      designProject: {
        select: {
          orderItem: { select: { order: { select: { album: { select: { userId: true } } } } } },
        },
      },
    },
  });
  if (!revision) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }
  if (revision.designProject.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const dataJson = normalizeEditorDataJson(revision.dataJson, {
    templateId: null,
    orderItemId: null,
  });

  if (dataJson.exportStatus === "EXPORTED") {
    console.info("[school_design_export] export_download_ready", { revisionId });
  }

  return NextResponse.json({
    exportStatus: dataJson.exportStatus ?? null,
    exportUrlJpg: dataJson.exportUrlJpg ?? null,
    exportUrlPdf: dataJson.exportUrlPdf ?? null,
    exportGeneratedAt: dataJson.exportGeneratedAt ?? null,
    exportVersion: dataJson.exportVersion ?? null,
    exportError: dataJson.exportError ?? null,
    updatedAt: null,
  });
}
