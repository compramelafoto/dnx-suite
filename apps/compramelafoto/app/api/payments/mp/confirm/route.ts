import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPaymentById,
  mapPaymentStatusToOrderStatus,
  mapPaymentStatusToPaymentStatus,
  type OrderType,
} from "@/lib/mercadopago";
import { calculateOrderCommissions } from "@/lib/services/commissionService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { revokeOrderDownloadTokens } from "@/lib/download-tokens";
import { queueOrderConfirmationEmail } from "@/lib/order-confirmation-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/mp/confirm
 * Confirma el estado de un pago consultando directamente a Mercado Pago
 * Usado en modo TEST cuando no hay webhooks disponibles
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const paymentId = body.paymentId as string;
    const orderId = Number(body.orderId);
    const orderType = (body.orderType || "PRINT_ORDER") as OrderType;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "paymentId es requerido" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    let accessTokenOverride: string | undefined;

    let digitalDelivery: { downloadUrl: string | null; expiresAt: Date; emailWhenReady?: boolean } | null = null;

    if (orderType === "PRINT_ORDER") {
      const order = await prisma.printOrder.findUnique({
        where: { id: orderId },
        select: { photographerId: true, labId: true },
      });
      if (order?.photographerId) {
        const photographer = await prisma.user.findUnique({
          where: { id: order.photographerId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
        }
      }
      if (!accessTokenOverride && order?.labId) {
        const lab = await prisma.lab.findUnique({
          where: { id: order.labId },
          select: { mpAccessToken: true },
        });
        if (lab?.mpAccessToken) {
          accessTokenOverride = lab.mpAccessToken;
        }
      }
    } else if (orderType === "PRECOMPRA_ORDER") {
      const order = await prisma.preCompraOrder.findUnique({
        where: { id: orderId },
        select: { albumId: true },
      });
      if (order?.albumId) {
        const album = await prisma.album.findUnique({
          where: { id: order.albumId },
          select: { userId: true },
        });
        if (album?.userId) {
          const photographer = await prisma.user.findUnique({
            where: { id: album.userId },
            select: { mpAccessToken: true },
          });
          if (photographer?.mpAccessToken) {
            accessTokenOverride = photographer.mpAccessToken;
          }
        }
      }
    } else {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { albumId: true },
      });
      if (order?.albumId) {
        const album = await prisma.album.findUnique({
          where: { id: order.albumId },
          select: { userId: true },
        });
        if (album?.userId) {
          const photographer = await prisma.user.findUnique({
            where: { id: album.userId },
            select: { mpAccessToken: true },
          });
          if (photographer?.mpAccessToken) {
            accessTokenOverride = photographer.mpAccessToken;
          }
        }
      }
    }

    // Consultar el pago en Mercado Pago con el token correcto
    const paymentInfo = await getPaymentById(paymentId, { accessTokenOverride });

    // Verificar que el external_reference coincida con el orderId
    if (paymentInfo.external_reference !== String(orderId)) {
      return NextResponse.json(
        {
          error: "El paymentId no corresponde al orderId",
          paymentExternalRef: paymentInfo.external_reference,
          providedOrderId: orderId,
        },
        { status: 400 }
      );
    }

    // Mapear estados
    const orderStatus = mapPaymentStatusToOrderStatus(paymentInfo.status);
    const paymentStatus = mapPaymentStatusToPaymentStatus(paymentInfo.status);

    // Actualizar el pedido según su tipo
    if (orderType === "PRINT_ORDER") {
      const updateData: any = {
        paymentStatus,
        mpPaymentId: paymentId,
        statusUpdatedAt: new Date(),
      };

      // Solo actualizar status si el pago fue aprobado o rechazado
      if (paymentInfo.status === "approved") {
        // Para pedidos de imprimir-publico, el pago se hace inmediatamente
        // Por lo tanto, cuando se aprueba el pago, el pedido pasa directamente a IN_PRODUCTION
        // ya que ya fue enviado al laboratorio y pagado
        updateData.status = "IN_PRODUCTION";
        updateData.statusUpdatedAt = new Date();
      } else if (paymentInfo.status === "rejected" || paymentInfo.status === "cancelled") {
        // No cambiar status del pedido si fue rechazado, solo paymentStatus
        // El pedido puede seguir en CREATED o IN_PRODUCTION
      } else if (paymentInfo.status === "refunded" || paymentInfo.status === "charged_back") {
        // Mantener status operativo; solo marcar pago como reembolsado
      }

      await prisma.printOrder.update({
        where: { id: orderId },
        data: updateData,
      });

      if (paymentInfo.status === "approved") {
        await calculateOrderCommissions(orderId);
      }
    } else if (orderType === "PRECOMPRA_ORDER") {
      if (paymentInfo.status === "approved") {
        await prisma.preCompraOrder.update({
          where: { id: orderId },
          data: { status: "PAID_HELD" },
        });
      } else if (paymentInfo.status === "rejected" || paymentInfo.status === "cancelled") {
        await prisma.preCompraOrder.update({
          where: { id: orderId },
          data: { status: "CANCELED" },
        });
      }
    } else {
      // ALBUM_ORDER
      const updateData: any = {
        // El modelo Order solo tiene status, no paymentStatus
        status: orderStatus === "PAID" ? "PAID" : orderStatus === "FAILED" ? "FAILED" : "PENDING",
      };

      let order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { album: { select: { userId: true } } },
      });
      if (!order) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }

      if (paymentInfo.status === "approved") {
        const percent = await resolvePlatformCommissionPercent({
          photographerId: order.album?.userId ?? null,
        });
        const extensionSurchargeCents = Number(order.extensionSurchargeCents ?? 0);
        const baseTotalCents = Math.max(0, order.totalCents - extensionSurchargeCents);
        const baseCommission = feeFromTotal(baseTotalCents, percent);
        // Extensión de almacenamiento: 100% para la plataforma
        const platformCommissionCents = baseCommission + extensionSurchargeCents;
        updateData.platformCommissionCents = platformCommissionCents;
        digitalDelivery = await ensureDigitalDelivery(orderId);
      } else if (paymentInfo.status === "refunded" || paymentInfo.status === "charged_back") {
        updateData.status = "REFUNDED";
        try {
          await revokeOrderDownloadTokens(orderId);
        } catch (err: any) {
          console.error("Error revocando tokens de descarga:", err);
        }
      }

      try {
        await prisma.order.update({
          where: { id: orderId },
          data: updateData,
        });
      } catch (err: any) {
        const msg = String(err?.message ?? "");
        if (msg.includes("platformCommissionCents") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
          const fallbackData = { ...updateData };
          delete fallbackData.platformCommissionCents;
          await prisma.order.update({
            where: { id: orderId },
            data: fallbackData,
          });
        } else {
          throw err;
        }
      }

      if (paymentInfo.status === "approved") {
        queueOrderConfirmationEmail(orderId).catch((err) =>
          console.error("Error encolando email de confirmación de pedido:", err)
        );
      } else if (paymentInfo.status === "refunded" || paymentInfo.status === "charged_back") {
        try {
          const tag = `ALBUM_ORDER:${orderId}`;
          await prisma.printOrder.updateMany({
            where: { tags: { has: tag } },
            data: {
              paymentStatus: "REFUNDED",
              mpPaymentId: paymentId,
              statusUpdatedAt: new Date(),
            },
          });
        } catch (err: any) {
          console.error("Error actualizando PrintOrder espejo (REFUNDED):", err);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        orderId,
        orderType,
        paymentId,
        paymentStatus: paymentInfo.status,
        orderStatus,
        paymentStatusInternal: paymentStatus,
        transactionAmount: paymentInfo.transaction_amount,
        currency: paymentInfo.currency_id,
        dateApproved: paymentInfo.date_approved,
        digitalDelivery: digitalDelivery
          ? {
              downloadUrl: digitalDelivery.downloadUrl ?? null,
              expiresAt: digitalDelivery.expiresAt,
              emailWhenReady: digitalDelivery.emailWhenReady ?? false,
            }
          : null,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("CONFIRM PAYMENT ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error confirmando pago",
        detail: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}
