import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { loadDesignProjectEditorContext, normalizeEditorDataJson } from "@/lib/school-render/design-editor";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const designProjectId = parseInt(id, 10);
  if (!Number.isFinite(designProjectId) || designProjectId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ctx = await loadDesignProjectEditorContext(designProjectId);
  if (!ctx) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (ctx.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const revision = ctx.revisions[0] ?? null;
  const dataJson = normalizeEditorDataJson(revision?.dataJson ?? null, {
    templateId: ctx.templateId ?? null,
    orderItemId: ctx.orderItemId,
  });
  if (ctx.status === "EXPORTED") {
    dataJson.exportStatus = "EXPORTED";
  } else if (ctx.status === "EXPORTING") {
    dataJson.exportStatus = "EXPORTING";
  }

  const ord = ctx.orderItem.order;
  return NextResponse.json({
    project: {
      id: ctx.id,
      status: ctx.status,
      orderItemId: ctx.orderItemId,
      templateId: ctx.templateId,
      currentRevisionId: ctx.currentRevisionId ?? revision?.id ?? null,
    },
    schoolOrderContext: {
      studentFirstName: ord.studentFirstName,
      studentLastName: ord.studentLastName,
      schoolCourse: ord.schoolCourse,
      album: {
        id: ord.album.id,
        title: ord.album.title,
        publicSlug: ord.album.publicSlug,
        school: ord.album.school,
      },
    },
    template: ctx.template,
    selection: ctx.orderItem.selection?.photos ?? [],
    revision: {
      id: revision?.id ?? null,
      dataJson,
    },
  });
}
