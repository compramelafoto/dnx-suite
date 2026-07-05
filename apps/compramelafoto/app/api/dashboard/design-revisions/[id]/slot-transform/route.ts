import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { loadDesignProjectEditorContext, normalizeEditorDataJson, updateDesignRevisionDataJson } from "@/lib/school-render/design-editor";

const BodySchema = z.object({
  slotId: z.number().int().positive(),
  cropX: z.number().optional(),
  cropY: z.number().optional(),
  zoom: z.number().optional(),
  rotation: z.number().optional(),
  fitMode: z.string().optional(),
  manualOverride: z.boolean().optional(),
});

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

  const slotExists = ctx.template?.slots?.some((s) => s.id === parsed.data.slotId);
  if (!slotExists) {
    console.warn("[school_design_editor] invalid_editor_action", {
      designProjectId: ctx.id,
      revisionId,
      action: "slot_transform",
      slotId: parsed.data.slotId,
    });
    return NextResponse.json({ error: "Slot inválido" }, { status: 400 });
  }

  const data = normalizeEditorDataJson(revision.dataJson ?? null, {
    templateId: ctx.templateId ?? null,
    orderItemId: ctx.orderItemId,
  });
  const key = String(parsed.data.slotId);
  const prev = data.slotOverrides[key] ?? {};
  data.slotOverrides[key] = {
    ...prev,
    ...parsed.data,
    manualOverride: parsed.data.manualOverride ?? true,
  };
  data.previewDirty = true;
  data.previewStatus = "DIRTY";

  await updateDesignRevisionDataJson(revision.id, data);
  console.info("[school_design_editor] slot_transform_updated", {
    designProjectId: ctx.id,
    revisionId,
    slotId: parsed.data.slotId,
  });
  console.info("[school_design_editor] preview_marked_dirty", {
    designProjectId: ctx.id,
    revisionId,
  });
  return NextResponse.json({ ok: true });
}
