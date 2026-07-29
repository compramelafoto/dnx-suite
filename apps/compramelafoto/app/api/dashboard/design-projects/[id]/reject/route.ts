import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { rejectDesignProject } from "@/lib/school-render/design-review";

const BodySchema = z.object({
  reason: z.string().trim().min(1),
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

  const result = await rejectDesignProject({
    designProjectId,
    userId: user.id,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo rechazar" },
      { status: result.httpStatus ?? 400 }
    );
  }
  return NextResponse.json({ ok: true, status: result.status });
}
