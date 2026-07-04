import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDesignProjectForOrderItem } from "@/lib/school-design/ensure-design-project";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — Asegura DesignProject + revisión inicial (idempotente). Requiere ítem READY_TO_DESIGN.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ albumId: string; orderItemId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { albumId: a, orderItemId: oi } = await params;
    const albumId = parseInt(a, 10);
    const orderItemId = parseInt(oi, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(orderItemId)) {
      return NextResponse.json({ error: "IDs inválidos" }, { status: 400 });
    }

    const item = await prisma.preCompraOrderItem.findFirst({
      where: {
        id: orderItemId,
        order: { albumId, album: { userId: user.id } },
      },
      select: { id: true },
    });
    if (!item) {
      return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
    }

    const res = await ensureDesignProjectForOrderItem(orderItemId);
    if (!res.ok) {
      return NextResponse.json({ error: res.message, code: res.code }, { status: 400 });
    }

    return NextResponse.json({
      designProjectId: res.designProjectId,
      created: res.created,
    });
  } catch (e) {
    console.error("[school_redeem_design_gate] ensure-design POST", e);
    return NextResponse.json({ error: "Error al asegurar diseño" }, { status: 500 });
  }
}
