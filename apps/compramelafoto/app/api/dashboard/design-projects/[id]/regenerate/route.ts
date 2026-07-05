import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { requestDesignRegeneration } from "@/lib/school-render/design-review";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
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

  const result = await requestDesignRegeneration({
    designProjectId,
    userId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "No se pudo regenerar" },
      { status: result.httpStatus ?? 400 }
    );
  }
  return NextResponse.json({ ok: true, status: result.status });
}
