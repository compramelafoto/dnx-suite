import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteCtx = { params: { id: string } | Promise<{ id: string }> };

function friendlyMessage(reason: string): string {
  if (reason === "not_school_album") {
    return "Este pedido no pertenece a un contexto escolar.";
  }
  if (reason === "invalid_status") {
    return "Solo podés iniciar la etapa física cuando el ítem está exportado.";
  }
  return "No se pudo iniciar la etapa física.";
}

/**
 * POST: pasar un ítem escolar de EXPORTED a PHYSICAL_IN_PROGRESS (fotógrafo).
 */
export async function POST(_req: Request, context: RouteCtx) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  }

  const { id } = await Promise.resolve(context.params);
  const itemId = parseInt(id, 10);
  if (!Number.isFinite(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const item = await prisma.preCompraOrderItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      status: true,
      order: {
        select: {
          album: { select: { userId: true, schoolId: true } },
          schoolCourseId: true,
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json(
      {
        ok: false,
        outcome: "skipped",
        reason: "item_not_found",
        message: "No encontramos ese ítem.",
      },
      { status: 404 }
    );
  }

  const album = item.order.album;
  if (!album || album.userId !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        outcome: "skipped",
        reason: "forbidden",
        message: "No encontramos ese ítem.",
      },
      { status: 404 }
    );
  }

  const isSchoolOrder = album.schoolId != null || item.order.schoolCourseId != null;
  if (!isSchoolOrder) {
    const reason = "not_school_album";
    return NextResponse.json(
      {
        ok: false,
        outcome: "skipped",
        reason,
        message: friendlyMessage(reason),
      },
      { status: 400 }
    );
  }

  if (item.status !== "EXPORTED") {
    const reason = "invalid_status";
    return NextResponse.json(
      {
        ok: false,
        outcome: "skipped",
        reason,
        message: friendlyMessage(reason),
      },
      { status: 400 }
    );
  }

  await prisma.preCompraOrderItem.update({
    where: { id: itemId },
    data: { status: "PHYSICAL_IN_PROGRESS" },
  });

  return NextResponse.json({
    ok: true,
    itemId,
    status: "PHYSICAL_IN_PROGRESS" as const,
  });
}
