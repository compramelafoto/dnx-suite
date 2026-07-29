import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { approveDesignProject } from "@/lib/school-render/design-review";
import { normalizeEditorDataJson } from "@/lib/school-render/design-editor";

const BodySchema = z.object({
  note: z.string().trim().optional(),
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
  const designProjectId = parseInt(id, 10);
  if (!Number.isFinite(designProjectId) || designProjectId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const project = await prisma.designProject.findUnique({
    where: { id: designProjectId },
    select: {
      id: true,
      orderItem: {
        select: { order: { select: { album: { select: { userId: true } } } } },
      },
      revisions: {
        select: { id: true, dataJson: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (project.orderItem.order.album.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const revision = project.revisions[0] ?? null;
  const dataJson = normalizeEditorDataJson(revision?.dataJson ?? null, {
    templateId: null,
    orderItemId: null,
  });
  if (dataJson.previewStatus === "RENDERING") {
    console.warn("[school_design_preview_job] approval_blocked_rendering", {
      designProjectId,
      revisionId: revision?.id ?? null,
    });
    return NextResponse.json({ error: "La preview se está regenerando" }, { status: 409 });
  }
  if (dataJson.previewStatus === "FAILED") {
    console.warn("[school_design_preview_job] approval_blocked_failed_preview", {
      designProjectId,
      revisionId: revision?.id ?? null,
    });
    return NextResponse.json({ error: "La preview falló, reintentá la regeneración" }, { status: 409 });
  }
  if (dataJson.previewDirty) {
    console.warn("[school_design_preview] approval_blocked_dirty_preview", {
      designProjectId,
      revisionId: revision?.id ?? null,
    });
    return NextResponse.json({ error: "La preview tiene cambios sin regenerar" }, { status: 409 });
  }

  const result = await approveDesignProject({
    designProjectId,
    userId: user.id,
    note: parsed.data.note ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo aprobar" },
      { status: result.httpStatus ?? 400 }
    );
  }
  return NextResponse.json({ ok: true, status: result.status });
}
