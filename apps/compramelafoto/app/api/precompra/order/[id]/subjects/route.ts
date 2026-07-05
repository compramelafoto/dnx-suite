import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/precompra/order/[id]/subjects
 * Crear un subject (niño) para la orden. Body: { label: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json();
    const label = String(body?.label ?? "").trim();
    if (!label) {
      return NextResponse.json({ error: "label es requerido" }, { status: 400 });
    }

    const order = await prisma.preCompraOrder.findUnique({
      where: { id: orderId },
      select: { id: true, albumId: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const subject = await prisma.subject.create({
      data: {
        albumId: order.albumId,
        label,
        createdByOrderId: orderId,
      },
    });

    return NextResponse.json({ subject });
  } catch (e) {
    console.error("precompra subject create error:", e);
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
