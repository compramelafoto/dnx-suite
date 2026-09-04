import { NextRequest, NextResponse } from "next/server";
import {
  OrderOrigin,
  OrderStatus,
  PreCompraOrderStatus,
  Role,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { isAlbumTestOwnerPhotographer } from "@/lib/public-album-test-access";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOG_SIM = "[TEST_CHECKOUT] simulate payment result";

type SimResult = "approved" | "pending" | "rejected";

/**
 * POST /api/payments/simulated/confirm
 * Actualiza estados de un pedido bridge TEST (Order PREVENTA_PACK + PreCompraOrder).
 */
export async function POST(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const orderIdRaw = body.orderId;
    const result = body.result as SimResult | undefined;

    const orderId =
      typeof orderIdRaw === "string"
        ? parseInt(orderIdRaw, 10)
        : typeof orderIdRaw === "number"
          ? orderIdRaw
          : NaN;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    if (result !== "approved" && result !== "pending" && result !== "rejected") {
      return NextResponse.json(
        { error: "result debe ser approved, pending o rejected" },
        { status: 400 }
      );
    }

    const orderRow = await prisma.order.findUnique({
      where: { id: orderId },
      include: { album: { select: { id: true, userId: true, isTest: true } } },
    });

    if (!orderRow) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (!orderRow.isTest) {
      return NextResponse.json(
        { error: "Solo pedidos de simulación (isTest) pueden confirmarse por este endpoint." },
        { status: 403 }
      );
    }

    if (!isAlbumTestOwnerPhotographer(orderRow.album, user)) {
      return NextResponse.json({ error: "No autorizado para este pedido de prueba." }, { status: 403 });
    }

    if (orderRow.origin !== OrderOrigin.PREVENTA_PACK || !orderRow.preCompraPaymentRef) {
      return NextResponse.json(
        { error: "Este endpoint aplica a pedidos preventa pack de simulación." },
        { status: 400 }
      );
    }

    const pcoId = parseInt(String(orderRow.preCompraPaymentRef).trim(), 10);
    if (!Number.isFinite(pcoId) || pcoId <= 0) {
      return NextResponse.json({ error: "Referencia de precompra inválida" }, { status: 400 });
    }

    let orderStatus: OrderStatus;
    let preStatus: PreCompraOrderStatus;

    if (result === "approved") {
      orderStatus = OrderStatus.PAID;
      preStatus = PreCompraOrderStatus.PAID_HELD;
    } else if (result === "pending") {
      orderStatus = OrderStatus.PENDING;
      preStatus = PreCompraOrderStatus.CREATED;
    } else {
      orderStatus = OrderStatus.FAILED;
      preStatus = PreCompraOrderStatus.CREATED;
    }

    await prisma.$transaction(async (tx) => {
      const pre = await tx.preCompraOrder.findFirst({
        where: { id: pcoId, albumId: orderRow.albumId, isTest: true },
      });
      if (!pre) {
        throw new Error("precompra_not_found_or_not_test");
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: orderStatus },
      });

      await tx.preCompraOrder.update({
        where: { id: pcoId },
        data: { status: preStatus },
      });
    });

    // Igual que el webhook real: sin este link el checkout simulado no llega al canje,
    // que es justo la parte que conviene ensayar.
    let packAccessUrl: string | null = null;
    if (result === "approved") {
      try {
        // `create` y no `ensure`: en un pedido de prueba querés un link usable cada vez que
        // simulás la aprobación. Rota el anterior, que en un álbum de prueba no molesta.
        const tokenData = await createPackAccessTokenForOrder(orderId, { revokeExisting: true });
        if (tokenData?.token) {
          const appUrl =
            process.env.APP_URL ||
            (process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : "https://compramelafoto.com");
          packAccessUrl = `${appUrl}/cliente/pack/${tokenData.token}`;
        }
      } catch (err) {
        // El pedido simulado ya quedó pagado; no lo tiramos abajo por el link.
        console.error("[TEST_CHECKOUT] pack_access_token_failed", { orderId, err });
      }
    }

    console.info(LOG_SIM, { orderId, preCompraOrderId: pcoId, result, orderStatus, preStatus, userId: user.id });

    return NextResponse.json({
      ok: true,
      orderId,
      preCompraOrderId: pcoId,
      result,
      orderStatus,
      preCompraOrderStatus: preStatus,
      /** Link de canje para seguir la prueba (solo en "approved"). No se manda por email; rota en cada simulación. */
      packAccessUrl,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "precompra_not_found_or_not_test") {
      return NextResponse.json(
        { error: "PreCompraOrder de prueba no encontrado o no coincide con el pedido." },
        { status: 400 }
      );
    }
    console.error("simulated confirm error:", e);
    return NextResponse.json({ error: "Error al simular confirmación" }, { status: 500 });
  }
}
