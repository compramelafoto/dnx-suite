import { NextResponse } from "next/server";
import { OrderOrigin, type OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import {
  getPaymentById,
  mapPaymentStatusToOrderStatus,
  mapPaymentStatusToPaymentStatus,
  type OrderType,
} from "@/lib/mercadopago";
import { calculateOrderCommissions } from "@/lib/services/commissionService";
import {
  ensureDigitalDelivery,
  getDigitalDownloadStatus,
  type DigitalDeliveryResult,
} from "@/lib/digital-delivery";
import { getOrderDownloadTokens, revokeOrderDownloadTokens } from "@/lib/download-tokens";
import {
  buildZipDownloadApiUrl,
} from "@/lib/digital-download/download-center-url";
import { getOrderDownloadCenterAccessToken } from "@/lib/digital-download/load-download-center";
import { resolveClientDigitalDownloadLinks } from "@/lib/digital-download/download-center-rollout";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";
import { resolveDnxCourseMpAccessToken, logDnxCourseMpTokenMissing } from "@/lib/dnx-foto-basica-funes";

const LOG_BLOCKED = "[TEST_CHECKOUT] blocked real payment flow";

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

    let digitalDelivery: DigitalDeliveryResult | null = null;

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
    } else if (orderType === "DNX_COURSE_ENROLLMENT") {
      const t = await resolveDnxCourseMpAccessToken();
      if (t) accessTokenOverride = t;
      else {
        logDnxCourseMpTokenMissing("POST /api/payments/mp/confirm", { orderId, orderType });
        return NextResponse.json(
          { error: "Cobro del curso no configurado en el servidor (token MP)." },
          { status: 503 }
        );
      }
    } else if (orderType === "ALBUM_ORDER") {
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

    if (orderType === "ALBUM_ORDER") {
      const ordMeta = await prisma.order.findUnique({
        where: { id: orderId },
        select: { isTest: true },
      });
      if (ordMeta?.isTest) {
        console.info(LOG_BLOCKED, { route: "/api/payments/mp/confirm", orderId, orderType });
        return NextResponse.json(
          { error: "Pedido de simulación: no se confirma con Mercado Pago." },
          { status: 400 }
        );
      }
    } else if (orderType === "PRECOMPRA_ORDER") {
      const pcMeta = await prisma.preCompraOrder.findUnique({
        where: { id: orderId },
        select: { isTest: true },
      });
      if (pcMeta?.isTest) {
        console.info(LOG_BLOCKED, { route: "/api/payments/mp/confirm", orderId, orderType });
        return NextResponse.json(
          { error: "Pedido de simulación: no se confirma con Mercado Pago." },
          { status: 400 }
        );
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

    let albumIdForClient: number | null = null;
    let preCompraOrderIdForClient: number | null = null;

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
      const pcMeta = await prisma.preCompraOrder.findUnique({
        where: { id: orderId },
        select: { id: true, albumId: true },
      });
      logLegacyPreventaUsage({
        source: "legacy_precompra_order",
        route: "/api/payments/mp/confirm",
        orderType: "PRECOMPRA_ORDER",
        orderId,
        preCompraOrderId: pcMeta?.id ?? orderId,
        albumId: pcMeta?.albumId ?? null,
        paymentId,
        externalReference: paymentInfo.external_reference ?? null,
        mpStatus: paymentInfo.status,
        ok: true,
      });
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
    } else if (orderType === "DNX_COURSE_ENROLLMENT") {
      const enroll = await prisma.dnxCourseEnrollment.findUnique({
        where: { id: orderId },
        select: { id: true },
      });
      if (!enroll) {
        return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
      }
      if (paymentInfo.status === "approved") {
        await prisma.dnxCourseEnrollment.updateMany({
          where: { id: orderId, status: "PENDING_PAYMENT" },
          data: {
            status: "APPROVED",
            mpPaymentId: paymentId,
            paidAt: new Date(),
          },
        });
      } else if (paymentInfo.status === "rejected" || paymentInfo.status === "cancelled") {
        await prisma.dnxCourseEnrollment.updateMany({
          where: { id: orderId, status: "PENDING_PAYMENT" },
          data: { status: "CANCELLED" },
        });
      }
    } else {
      // ALBUM_ORDER
      const albumRow = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, albumId: true, origin: true, preCompraPaymentRef: true, createdAt: true },
      });
      if (!albumRow) {
        return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
      }
      albumIdForClient = albumRow.albumId ?? null;
      if (
        albumRow.origin === OrderOrigin.PREVENTA_PACK &&
        albumRow.preCompraPaymentRef
      ) {
        const p = parseInt(String(albumRow.preCompraPaymentRef).trim(), 10);
        if (Number.isFinite(p) && p > 0) preCompraOrderIdForClient = p;
      }

      if (paymentInfo.status === "approved") {
        const digitalItems = await prisma.orderItem.findMany({
          where: { orderId, productType: "DIGITAL" },
          select: { photoId: true },
        });
        const photoIds = digitalItems
          .map((item) => item.photoId)
          .filter((id): id is number => Number.isFinite(id));

        const { finalizeAlbumOrderMercadoPagoApproved } = await import(
          "@/lib/mercadopago/finalize-album-order-mp-approved"
        );
        const fin = await finalizeAlbumOrderMercadoPagoApproved(orderId, paymentId, {
          accessTokenOverride,
        });
        if (!fin.ok) {
          return NextResponse.json(
            {
              error: fin.error || "finalize_album_order_failed",
              orderId,
              paymentId,
            },
            { status: 400 }
          );
        }
        digitalDelivery = await ensureDigitalDelivery(orderId);
        if (digitalDelivery) {
          const baseUrl =
            process.env.APP_URL ||
            (typeof req.url === "string" ? req.url.split("/api")[0] : "") ||
            "";

          const centerToken = await getOrderDownloadCenterAccessToken(orderId);
          if (centerToken && albumRow.createdAt) {
            const links = resolveClientDigitalDownloadLinks({
              orderId,
              orderCreatedAt: albumRow.createdAt,
              accessToken: centerToken,
              baseUrl,
              context: "mp_confirm",
            });
            digitalDelivery.downloadCenterUrl = links.downloadCenterUrl;
          }

          if (photoIds.length === 1) {
            const singlePhotoId = photoIds[0];
            const existingTokens = await getOrderDownloadTokens(orderId);
            const existingPhotoToken = existingTokens.find(
              (t) => t.type === "CLIENT_DIGITAL" && t.photoId === singlePhotoId
            );
            const orderToken =
              existingTokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId)?.token ??
              centerToken;
            if (orderToken) {
              digitalDelivery.downloadUrl = buildZipDownloadApiUrl(orderToken, baseUrl);
              digitalDelivery.emailWhenReady = false;
            } else if (existingPhotoToken?.token) {
              digitalDelivery.downloadUrl = buildZipDownloadApiUrl(
                existingPhotoToken.token,
                baseUrl
              );
              digitalDelivery.emailWhenReady = false;
            }
          } else if (photoIds.length > 1) {
            const status = await getDigitalDownloadStatus(orderId);
            if (status?.hasZipReady && status.token) {
              digitalDelivery.downloadUrl = buildZipDownloadApiUrl(status.token, baseUrl);
              digitalDelivery.emailWhenReady = false;
              digitalDelivery.isPreparing = false;
            } else {
              digitalDelivery.downloadUrl = null;
              digitalDelivery.isPreparing = true;
            }
          }
        }
      } else if (paymentInfo.status === "refunded" || paymentInfo.status === "charged_back") {
        try {
          await prisma.order.update({
            where: { id: orderId },
            data: { status: "REFUNDED" },
          });
        } catch (err: any) {
          console.error("Error actualizando Order REFUNDED:", err);
        }
        try {
          await revokeOrderDownloadTokens(orderId);
        } catch (err: any) {
          console.error("Error revocando tokens de descarga:", err);
        }
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
      } else {
        const nextStatus: OrderStatus =
          orderStatus === "PAID"
            ? "PAID"
            : orderStatus === "FAILED"
              ? "FAILED"
              : "PENDING";
        await prisma.order.update({
          where: { id: orderId },
          data: { status: nextStatus },
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        orderId,
        orderType,
        albumId: albumIdForClient,
        preCompraOrderId: preCompraOrderIdForClient,
        paymentId,
        paymentStatus: paymentInfo.status,
        orderStatus,
        paymentStatusInternal: paymentStatus,
        transactionAmount: paymentInfo.transaction_amount,
        currency: paymentInfo.currency_id,
        dateApproved: paymentInfo.date_approved,
        digitalDelivery: digitalDelivery
          ? {
              downloadCenterUrl: digitalDelivery.downloadCenterUrl ?? null,
              downloadUrl: digitalDelivery.downloadUrl ?? null,
              expiresAt: digitalDelivery.expiresAt,
              emailWhenReady: digitalDelivery.emailWhenReady ?? false,
              isPreparing: digitalDelivery.isPreparing ?? false,
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
