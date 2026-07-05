import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/precompra/order/[id]
 * Detalle del pedido de pre-venta (para selfies y flujo cliente).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const uiRoute = req.headers.get("x-legacy-precompra-ui-route");

    const logUi = (fields: Record<string, unknown>) => {
      if (!uiRoute) return;
      logLegacyPreventaUsage({
        source: "legacy_precompra_ui",
        route: `/api/precompra/order/[id]`,
        uiPageRoute: uiRoute,
        preCompraOrderId: orderId,
        ...fields,
      });
    };

    if (!Number.isInteger(orderId) || orderId <= 0) {
      logUi({ albumId: null, ok: false, httpStatus: 400, reason: "invalid_id" });
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const order = await prisma.preCompraOrder.findUnique({
      where: { id: orderId },
      include: {
        album: { select: { id: true, title: true, publicSlug: true } },
        items: { include: { albumProduct: true, packDefinition: true, subject: true } },
        subjects: { include: { selfies: true } },
        selfies: { include: { subject: true } },
      },
    });

    if (!order) {
      logUi({ albumId: null, ok: false, httpStatus: 404 });
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    logUi({ albumId: order.albumId, ok: true, httpStatus: 200 });
    return NextResponse.json({ order });
  } catch (e) {
    console.error("precompra order get error:", e);
    return NextResponse.json({ error: "Error al cargar el pedido" }, { status: 500 });
  }
}
