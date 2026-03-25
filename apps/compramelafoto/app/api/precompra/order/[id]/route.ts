import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/precompra/order/[id]
 * Detalle del pedido de pre-venta (para selfies y flujo cliente).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.preCompraOrder.findUnique({
      where: { id: orderId },
      include: {
        album: { select: { id: true, title: true, publicSlug: true } },
        items: { include: { albumProduct: true, subject: true } },
        subjects: { include: { selfies: true } },
        selfies: { include: { subject: true } },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (e) {
    console.error("precompra order get error:", e);
    return NextResponse.json({ error: "Error al cargar el pedido" }, { status: 500 });
  }
}
