import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { albumOrderCanRetryPayment } from "@/lib/mercadopago/album-order-payment-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/a/[id]/orders/[orderId]/checkout-status
 * Estado público mínimo para banner de pago pendiente (mismo álbum, sin datos sensibles).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; orderId: string } | Promise<{ id: string; orderId: string }> }
) {
  try {
    const { id, orderId: orderIdParam } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    const orderId = parseInt(orderIdParam, 10);
    if (!Number.isFinite(albumId) || albumId <= 0 || !Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, albumId, isTest: false },
      select: {
        id: true,
        status: true,
        isTest: true,
        checkoutPaymentSource: true,
        origin: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      orderId: order.id,
      albumId,
      status: order.status,
      canRetry: albumOrderCanRetryPayment(order),
    });
  } catch (err: unknown) {
    console.error("GET checkout-status", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
