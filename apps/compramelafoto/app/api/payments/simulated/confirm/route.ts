import { NextRequest, NextResponse } from "next/server";
import {
  OrderOrigin,
  OrderStatus,
  PreCompraOrderStatus,
  Role,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAuth } from "@/lib/auth";
import { isAlbumTestOwnerPhotographer } from "@/lib/public-album-test-access";
import { createPackAccessTokenForOrder } from "@/lib/preventa-canjeable/pack-access-tokens";
import { esUsuarioDemo } from "@/lib/demos/identidad";
import {
  finalizeAlbumGalleryOrderSimulatedApproved,
  finalizeAlbumOrderSimulatedApproved,
} from "@/lib/demos/pago-simulado";
import { getDemoActiva } from "@/lib/demos/sesion-demo";
import { evaluarPagoSimuladoGaleria } from "@/lib/demos/pago-simulado-galeria";

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

    // Compra de la galería de un álbum demo (no preventa): el comprador puede no ser fotógrafo,
    // así que la autorización es la de la demo (dueño del álbum o demo activa).
    if (orderRow.origin !== OrderOrigin.PREVENTA_PACK) {
      return confirmarPagoSimuladoGaleria(orderId, result);
    }

    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
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

    // Demos grabables: el "pago" deja el pedido igual que uno aprobado de verdad (comisiones,
    // entrega digital, diseños), sin avisos. Los demás álbumes de prueba siguen como antes.
    const owner = orderRow.album?.userId
      ? await prisma.user.findUnique({ where: { id: orderRow.album.userId }, select: { tags: true } })
      : null;
    if (result === "approved" && esUsuarioDemo(owner)) {
      const fin = await finalizeAlbumOrderSimulatedApproved(orderId);
      if (!fin.ok) {
        console.error(LOG_SIM, { orderId, error: fin.error });
        return NextResponse.json({ error: "No se pudo simular el pago." }, { status: 400 });
      }
      console.info(LOG_SIM, { orderId, preCompraOrderId: pcoId, result, demo: true, userId: user.id });
      return NextResponse.json({
        ok: true,
        orderId,
        preCompraOrderId: pcoId,
        result,
        orderStatus: OrderStatus.PAID,
        preCompraOrderStatus: PreCompraOrderStatus.PAID_HELD,
        packAccessUrl: fin.packToken ? `/cliente/pack/${fin.packToken}` : null,
      });
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

/**
 * Pago simulado de la compra de la galería de un álbum demo. Solo pedidos `isTest` (no preventa)
 * de álbumes cuyo dueño es un usuario demo, y solo para su dueño o con la demo activa.
 */
async function confirmarPagoSimuladoGaleria(orderId: number, result: SimResult) {
  const user = await getAuthUser();
  const actor = { userId: user?.id ?? null, demoActiva: (await getDemoActiva()) != null };

  if (result === "approved") {
    const fin = await finalizeAlbumGalleryOrderSimulatedApproved(orderId, actor);
    if (!fin.ok) {
      console.error(LOG_SIM, { orderId, error: fin.error, galeria: true });
      return NextResponse.json({ error: "No se pudo simular el pago." }, { status: 403 });
    }
    console.info(LOG_SIM, { orderId, result, demo: true, galeria: true, userId: actor.userId });
    return NextResponse.json({
      ok: true,
      orderId,
      result,
      orderStatus: OrderStatus.PAID,
      // Centro de descargas del pedido; sin fotos digitales, de vuelta al álbum.
      destino: fin.destino ?? `/a/${fin.albumId}`,
    });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      isTest: true,
      origin: true,
      status: true,
      album: { select: { user: { select: { id: true, tags: true } } } },
    },
  });
  const guarda = evaluarPagoSimuladoGaleria({
    pedido: order ? { isTest: order.isTest, origin: order.origin ?? null, status: order.status } : null,
    dueno: order?.album?.user ?? null,
    actor,
  });
  if (!guarda.ok || guarda.yaPagado) {
    return NextResponse.json({ error: "No se pudo simular el pago." }, { status: 403 });
  }
  const orderStatus = result === "pending" ? OrderStatus.PENDING : OrderStatus.FAILED;
  await prisma.order.update({ where: { id: orderId }, data: { status: orderStatus } });
  console.info(LOG_SIM, { orderId, result, orderStatus, demo: true, galeria: true, userId: actor.userId });
  return NextResponse.json({ ok: true, orderId, result, orderStatus });
}
