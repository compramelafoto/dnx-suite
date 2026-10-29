import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { crearPedidoPreventaSimulado } from "@/lib/preventa-canjeable/precompra-test-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG = "[TEST_CHECKOUT] create order";

/**
 * POST /api/precompra/order/test
 * Pedido preventa pack simulado (solo dueño + álbum isTest). Sin Mercado Pago.
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json();
    const res = await crearPedidoPreventaSimulado(user, body);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
    const { preCompraOrderId, orderId } = res;

    console.info(LOG, {
      albumId: Number((body as { albumId?: unknown })?.albumId),
      preCompraOrderId,
      orderId,
      userId: user.id,
    });

    const created = await prisma.preCompraOrder.findUnique({
      where: { id: preCompraOrderId },
      include: {
        items: { include: { albumProduct: true, packDefinition: true } },
      },
    });

    return NextResponse.json({
      order: created,
      preCompraOrderId,
      orderId,
    });
  } catch (e) {
    console.error("precompra order test create error:", e);
    if (e instanceof Error && e.message === "pack_not_found_for_snapshot") {
      return NextResponse.json({ error: "Pack no válido para este álbum" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear el pedido de prueba" }, { status: 500 });
  }
}
