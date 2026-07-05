import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateOrderCommissions } from "@/lib/services/commissionService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { getPaymentById, type OrderType } from "@/lib/mercadopago";
import { finalizeAlbumOrderMercadoPagoApproved } from "@/lib/mercadopago/finalize-album-order-mp-approved";
import { queuePhotographerOrderNotification, queuePhotographerPrintOrderNotification } from "@/lib/order-confirmation-email";
import { ensureWebhookIdempotency } from "@/lib/antifraud/webhook";
import { registerAuditEvent } from "@/lib/antifraud/audit";
import { consumeReferralEarningsForDiscount } from "@/lib/referral/consume-referral-earnings-discount";
import { createReferralEarningsForPaidSale } from "@/lib/referral/create-referral-earnings-for-paid-sale";
import { resolveAlbumEventIdFromPrintOrderTags } from "@/lib/referral/skip-referral-event-organizer-double-benefit";
import { recalcPendingPayoutRequestsForReferrers } from "@/lib/referral/recalc-pending-payout-requests";
import { reverseAlbumOrderMercadoPagoIfWasPaid } from "@/lib/mercadopago/reverse-album-order-mercado-pago";
import { syncPreCompraOrderFromMercadoPagoPayment } from "@/lib/mercadopago/reverse-precompra-order-mercado-pago";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";
import {
  DNX_FOTO_BASICA_FUNES_MAX_SEATS,
  getDnxCourseMpAccessToken,
  resolveDnxCourseMpAccessToken,
  logDnxCourseMpTokenMissing,
} from "@/lib/dnx-foto-basica-funes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Primera lectura del pago: si falla con token por defecto, reintenta con token del curso DNX (MP_ACCESS_TOKEN producción). */
async function getPaymentByIdWithCourseMpFallback(
  paymentId: string,
  accessTokenOverride?: string
): Promise<Awaited<ReturnType<typeof getPaymentById>>> {
  try {
    return await getPaymentById(paymentId, { accessTokenOverride });
  } catch (firstErr) {
    const courseTok = await resolveDnxCourseMpAccessToken();
    const envTok = getDnxCourseMpAccessToken();
    const firstTok = accessTokenOverride ?? envTok ?? undefined;
    if (!courseTok || courseTok === firstTok) {
      throw firstErr;
    }
    return await getPaymentById(paymentId, { accessTokenOverride: courseTok });
  }
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);

    const dataId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id");
    const orderIdParam = url.searchParams.get("orderId");
    const orderTypeParam = url.searchParams.get("orderType");

    let body: any = null;
    try {
      body = await req.json();
    } catch {}

    const paymentId = dataId || body?.data?.id || body?.id;

    if (!paymentId) {
      return NextResponse.json({ ok: true, note: "no payment id" });
    }

    let accessTokenOverride: string | undefined;
    const orderIdFromQuery = Number(orderIdParam);
    const orderTypeFromQuery = (orderTypeParam || undefined) as OrderType | undefined;

    if (Number.isFinite(orderIdFromQuery) && orderTypeFromQuery) {
      if (orderTypeFromQuery === "PRINT_ORDER") {
        const order = await prisma.printOrder.findUnique({
          where: { id: orderIdFromQuery },
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
      } else if (orderTypeFromQuery === "PRECOMPRA_ORDER") {
        const order = await prisma.preCompraOrder.findUnique({
          where: { id: orderIdFromQuery },
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
      } else if (orderTypeFromQuery === "DNX_COURSE_ENROLLMENT") {
        const t = await resolveDnxCourseMpAccessToken();
        if (t) accessTokenOverride = t;
      } else {
        const order = await prisma.order.findUnique({
          where: { id: orderIdFromQuery },
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
    }

    let pay = await getPaymentByIdWithCourseMpFallback(String(paymentId), accessTokenOverride);

    let orderId = Number(pay.external_reference);
    // Si external_reference tiene formato "PREFIX:123", extraer el número
    if (!Number.isFinite(orderId) && pay.external_reference?.includes(":")) {
      const match = pay.external_reference.match(/:(\d+)$/);
      if (match) orderId = Number(match[1]);
    }
    let orderType = (pay.metadata?.orderType || orderTypeFromQuery) as OrderType | undefined;
    // Fallback: inferir orderType buscando en cada tabla cuando metadata/query faltan
    if (!orderType && Number.isFinite(orderId)) {
      const [albumOrder, printOrder, precompraOrder, dnxEnrollment] = await Promise.all([
        prisma.order.findUnique({ where: { id: orderId }, select: { id: true } }),
        prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true } }),
        prisma.preCompraOrder.findUnique({ where: { id: orderId }, select: { id: true } }),
        prisma.dnxCourseEnrollment.findUnique({ where: { id: orderId }, select: { id: true } }),
      ]);
      if (albumOrder) orderType = "ALBUM_ORDER";
      else if (printOrder) orderType = "PRINT_ORDER";
      else if (precompraOrder) orderType = "PRECOMPRA_ORDER";
      else if (dnxEnrollment) orderType = "DNX_COURSE_ENROLLMENT";
    }
    orderType = orderType || "PRINT_ORDER";

    if (orderType === "DNX_COURSE_ENROLLMENT" && !accessTokenOverride) {
      const t = await resolveDnxCourseMpAccessToken();
      if (t) accessTokenOverride = t;
      else {
        logDnxCourseMpTokenMissing("webhook: no token antes de getPaymentById", {
          paymentId: String(paymentId),
          orderId: Number.isFinite(orderId) ? orderId : undefined,
        });
      }
    }

    if (Number.isFinite(orderId)) {
      if (orderType === "ALBUM_ORDER") {
        const oTest = await prisma.order.findUnique({
          where: { id: orderId },
          select: { isTest: true },
        });
        if (oTest?.isTest) {
          console.info("[TEST_CHECKOUT] blocked real payment flow", {
            webhook: true,
            orderId,
            orderType,
            paymentId: String(paymentId),
          });
          return NextResponse.json({ ok: true, note: "test_order_ignored", paymentId });
        }
      } else if (orderType === "PRECOMPRA_ORDER") {
        const pcTest = await prisma.preCompraOrder.findUnique({
          where: { id: orderId },
          select: { isTest: true },
        });
        if (pcTest?.isTest) {
          console.info("[TEST_CHECKOUT] blocked real payment flow", {
            webhook: true,
            orderId,
            orderType,
            paymentId: String(paymentId),
          });
          return NextResponse.json({ ok: true, note: "test_order_ignored", paymentId });
        }
      }
    }

    // Re-consultar el pago con el token del cobrador ya resuelto (OAuth fotógrafo / lab) y estado actual en MP
    pay = await getPaymentById(String(paymentId), { accessTokenOverride });
    let status = pay.status;

    // Antes de marcar idempotencia "approved", verificar que MP siga en approved (evita finalizar si ya hubo refund)
    if (
      Number.isFinite(orderId) &&
      (orderType === "ALBUM_ORDER" || orderType === "PRINT_ORDER") &&
      status === "approved"
    ) {
      const verified = await getPaymentById(String(paymentId), { accessTokenOverride });
      if (verified.status !== "approved") {
        console.warn("MP WEBHOOK: aviso approved pero estado actual distinto", {
          paymentId,
          orderId,
          orderType,
          actualStatus: verified.status,
        });
        return NextResponse.json({
          ok: true,
          paymentId,
          status: verified.status,
          orderId,
          orderType,
          note: "approved_notification_stale",
        });
      }
      pay = verified;
      status = pay.status;
    }

    // Idempotencia: un registro por paymentId + estado MP (pending → approved → refunded, etc.)
    const idempotency = await ensureWebhookIdempotency(String(paymentId), {
      orderId: Number.isFinite(orderId) ? orderId : undefined,
      orderType,
      status,
      externalRef: pay.external_reference ?? undefined,
    });
    if (idempotency.alreadyProcessed) {
      return NextResponse.json({ ok: true, note: "already_processed", paymentId });
    }

    if (Number.isFinite(orderId)) {
      if (orderType === "DNX_COURSE_ENROLLMENT") {
        if (status === "approved") {
          await prisma.$transaction(async (tx) => {
            const row = await tx.dnxCourseEnrollment.findUnique({
              where: { id: orderId },
              select: { id: true, courseKey: true, status: true },
            });
            if (!row || row.status !== "PENDING_PAYMENT") return;
            const approvedCount = await tx.dnxCourseEnrollment.count({
              where: { courseKey: row.courseKey, status: "APPROVED" },
            });
            if (approvedCount >= DNX_FOTO_BASICA_FUNES_MAX_SEATS) {
              console.error("MP WEBHOOK DNX: cupo ya completo al aprobar", { orderId, paymentId });
            }
            await tx.dnxCourseEnrollment.updateMany({
              where: { id: orderId, status: "PENDING_PAYMENT" },
              data: {
                status: "APPROVED",
                mpPaymentId: String(paymentId),
                paidAt: new Date(),
              },
            });
            const after = await tx.dnxCourseEnrollment.count({
              where: { courseKey: row.courseKey, status: "APPROVED" },
            });
            if (after > DNX_FOTO_BASICA_FUNES_MAX_SEATS) {
              console.error("MP WEBHOOK DNX: cupo superado tras pago — revisar manualmente", {
                orderId,
                courseKey: row.courseKey,
                paymentId: String(paymentId),
              });
            }
          });
        } else if (status === "rejected" || status === "cancelled") {
          await prisma.dnxCourseEnrollment.updateMany({
            where: { id: orderId, status: "PENDING_PAYMENT" },
            data: { status: "CANCELLED" },
          });
        }
      } else if (orderType === "PRECOMPRA_ORDER") {
        const pcRow = await prisma.preCompraOrder.findUnique({
          where: { id: orderId },
          select: { id: true, albumId: true },
        });
        logLegacyPreventaUsage({
          source: "legacy_precompra_order",
          route: "/api/payments/mp/webhook",
          orderType: "PRECOMPRA_ORDER",
          orderId,
          preCompraOrderId: pcRow?.id ?? orderId,
          albumId: pcRow?.albumId ?? null,
          paymentId: String(paymentId),
          externalReference: pay.external_reference ?? null,
          mpStatus: status,
          ok: true,
        });
        await syncPreCompraOrderFromMercadoPagoPayment(orderId, pay);
      } else if (orderType === "ALBUM_ORDER") {
        if (status === "approved") {
          const fin = await finalizeAlbumOrderMercadoPagoApproved(orderId, String(paymentId), {
            accessTokenOverride,
          });
          if (!fin.ok) {
            console.error("MP WEBHOOK: finalize ALBUM_ORDER falló", { orderId, paymentId, error: fin.error });
          }
        } else if (status === "rejected" || status === "cancelled") {
          const rev = await reverseAlbumOrderMercadoPagoIfWasPaid({
            orderId,
            mpPaymentId: String(paymentId),
            mpStatus: status,
            statusDetail: pay.status_detail,
            auditReason: status === "cancelled" ? "CANCELLED" : "REJECTED",
          });
          if (!rev.applied) {
            try {
              await prisma.order.update({
                where: { id: orderId },
                data: { status: "FAILED" },
              });
            } catch (err: any) {
              console.error("MP WEBHOOK: error actualizando Order a FAILED", err);
            }
            const orderForAudit = await prisma.order.findUnique({
              where: { id: orderId },
              select: { albumId: true },
            });
            await registerAuditEvent({
              targetOrderType: "ALBUM_ORDER",
              targetOrderId: orderId,
              targetAlbumId: orderForAudit?.albumId,
              eventType: "PAYMENT_REJECTED",
            });
            try {
              const tag = `ALBUM_ORDER:${orderId}`;
              await prisma.printOrder.updateMany({
                where: { tags: { has: tag } },
                data: {
                  paymentStatus: "FAILED",
                  mpPaymentId: String(paymentId),
                  statusUpdatedAt: new Date(),
                },
              });
            } catch (err: any) {
              console.error("Error actualizando PrintOrder espejo (FAILED):", err);
            }
          }
        } else if (status === "refunded" || status === "charged_back") {
          await reverseAlbumOrderMercadoPagoIfWasPaid({
            orderId,
            mpPaymentId: String(paymentId),
            mpStatus: status,
            statusDetail: pay.status_detail,
            auditReason: status === "charged_back" ? "CHARGED_BACK" : "REFUNDED",
          });
        }
      } else {
        if (status === "approved") {
          await prisma.printOrder.update({
            where: { id: orderId },
            data: {
              paymentStatus: "PAID",
              mpPaymentId: String(paymentId),
              statusUpdatedAt: new Date(),
            },
          });
          const printOrderForRef = await prisma.printOrder.findUnique({
            where: { id: orderId },
            select: {
              photographerId: true,
              labId: true,
              pricingSnapshot: true,
              total: true,
              referralFeeDiscountCents: true,
              tags: true,
            },
          });
          await registerAuditEvent({
            targetOrderType: "PRINT_ORDER",
            targetOrderId: orderId,
            eventType: "PAYMENT_APPROVED",
          });
          await registerAuditEvent({
            targetOrderType: "PRINT_ORDER",
            targetOrderId: orderId,
            eventType: "CUSTOMER_DATA_RELEASED",
          });
          await registerAuditEvent({
            targetOrderType: "PRINT_ORDER",
            targetOrderId: orderId,
            eventType: "ORDER_ITEMS_RELEASED",
          });
          if (printOrderForRef?.labId) {
            await registerAuditEvent({
              targetOrderType: "PRINT_ORDER",
              targetOrderId: orderId,
              eventType: "ORDER_SENT_TO_LAB",
            });
          }
          let platformFeeCentsPrint = Number((printOrderForRef?.pricingSnapshot as any)?.marketplaceFeeCents ?? 0);
          if (platformFeeCentsPrint <= 0 && printOrderForRef?.total) {
            const snap = (printOrderForRef.pricingSnapshot ?? {}) as Record<string, unknown>;
            const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
            if (pct > 0) {
              platformFeeCentsPrint = feeFromTotal(Number(printOrderForRef.total), pct);
            }
          }
          if (printOrderForRef?.photographerId == null || platformFeeCentsPrint <= 0) {
            if (printOrderForRef?.photographerId != null && platformFeeCentsPrint <= 0) {
              console.warn("WEBHOOK: Referido no creado – fee 0", { orderId, photographerId: printOrderForRef.photographerId });
            }
          } else {
            const referralFeeDiscountCentsPrint = Number(printOrderForRef?.referralFeeDiscountCents ?? 0);
            const albumEventId = await resolveAlbumEventIdFromPrintOrderTags(printOrderForRef.tags ?? []);
            const eventIdForOrganizerReferral =
              typeof albumEventId === "number" && albumEventId > 0 ? albumEventId : null;

            await createReferralEarningsForPaidSale({
              saleRef: `PRINT_ORDER:${orderId}`,
              orderType: "PRINT_ORDER",
              orderId,
              paymentId: String(paymentId),
              photographerUserId: printOrderForRef.photographerId,
              eventId: eventIdForOrganizerReferral,
              grossPlatformFeeCents: platformFeeCentsPrint,
              referralFeeDiscountCents: referralFeeDiscountCentsPrint,
            });

            if (referralFeeDiscountCentsPrint > 0 && printOrderForRef?.photographerId != null) {
              await consumeReferralEarningsForDiscount(
                printOrderForRef.photographerId,
                referralFeeDiscountCentsPrint,
                orderId,
                "PRINT_ORDER"
              );
            }
          }
          await calculateOrderCommissions(orderId);
          queuePhotographerPrintOrderNotification(orderId).catch((err) =>
            console.error("Error encolando email al fotógrafo (pedido impresión):", err)
          );
        } else if (status === "rejected" || status === "cancelled") {
          await prisma.printOrder.update({
            where: { id: orderId },
            data: {
              paymentStatus: "FAILED",
              mpPaymentId: String(paymentId),
              statusUpdatedAt: new Date(),
            },
          });
          await registerAuditEvent({
            targetOrderType: "PRINT_ORDER",
            targetOrderId: orderId,
            eventType: "PAYMENT_REJECTED",
          });
        } else if (status === "refunded" || status === "charged_back") {
          await prisma.printOrder.update({
            where: { id: orderId },
            data: {
              paymentStatus: "REFUNDED",
              mpPaymentId: String(paymentId),
              statusUpdatedAt: new Date(),
            },
          });
          try {
            await prisma.referralEarning.updateMany({
              where: { saleRef: `PRINT_ORDER:${orderId}` },
              data: { reversedAt: new Date() },
            });
            const reversed = await prisma.referralEarning.findMany({
              where: { saleRef: `PRINT_ORDER:${orderId}` },
              select: { attributionId: true },
            });
            if (reversed.length > 0) {
              const attrs = await prisma.referralAttribution.findMany({
                where: { id: { in: reversed.map((r) => r.attributionId) } },
                select: { referrerUserId: true },
              });
              await recalcPendingPayoutRequestsForReferrers(attrs.map((a) => a.referrerUserId));
            }
          } catch (err: any) {
            console.error("Error revirtiendo ReferralEarning (PRINT_ORDER reembolso):", err);
          }
        }
      }
    }

    return NextResponse.json({ ok: true, paymentId, status, orderId, orderType });
  } catch (err: any) {
    console.error("MP WEBHOOK ERROR >>>", err);
    return NextResponse.json({ ok: true, note: "webhook error" });
  }
}
