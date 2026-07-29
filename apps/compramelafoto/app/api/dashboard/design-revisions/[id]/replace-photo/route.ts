import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  loadDesignProjectEditorContext,
  normalizeEditorDataJson,
  updateDesignRevisionDataJson,
  replaceSlotPhotoInData,
} from "@/lib/school-render/design-editor";

const BodySchema = z.object({
  slotId: z.number().int().positive(),
  selectionPhotoId: z.number().int().positive(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
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

  const data = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: ctx.templateId ?? null,
    orderItemId: ctx.orderItemId,
  });
  const allowedSelectionIds = new Set(
    (ctx.orderItem.selection?.photos ?? []).map((p) => p.id)
  );
  const result = replaceSlotPhotoInData(
    data,
    parsed.data.slotId,
    parsed.data.selectionPhotoId,
    allowedSelectionIds
  );
  if (!result.ok) {
    console.warn("[school_design_editor] invalid_editor_action", {
      designProjectId: ctx.id,
      revisionId,
      action: "replace_photo",
    });
    return NextResponse.json({ error: result.error || "Acción inválida" }, { status: result.httpStatus ?? 400 });
  }

  data.previewStatus = "DIRTY";
  await updateDesignRevisionDataJson(revision.id, data);
  console.info("[school_design_editor] slot_photo_replaced", {
    designProjectId: ctx.id,
    revisionId,
    slotId: parsed.data.slotId,
    selectionPhotoId: parsed.data.selectionPhotoId,
  });
  console.info("[school_design_editor] preview_marked_dirty", {
    designProjectId: ctx.id,
    revisionId,
  });
  return NextResponse.json({ ok: true });
}
