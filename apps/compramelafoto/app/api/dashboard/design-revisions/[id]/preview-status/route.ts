import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { normalizeEditorDataJson } from "@/lib/school-render/design-editor";

export async function GET(
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
    select: {
      id: true,
      designProject: {
        select: {
          id: true,
          orderItem: { select: { order: { select: { album: { select: { userId: true } } } } } },
        },
      },
      dataJson: true,
    },
  });
  if (!revision) {
    return NextResponse.json({ error: "Revisión no encontrada" }, { status: 404 });
  }
  if (revision.designProject.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const data = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: null,
    orderItemId: null,
  });

  return NextResponse.json({
    ok: true,
    revisionId: revision.id,
    updatedAt: null,
    previewStatus: data.previewStatus ?? null,
    previewDirty: Boolean(data.previewDirty),
    previewUrl: data.previewUrl ?? null,
    previewGeneratedAt: data.previewGeneratedAt ?? null,
    previewVersion: data.previewVersion ?? null,
    previewError: data.previewError ?? null,
  });
}
