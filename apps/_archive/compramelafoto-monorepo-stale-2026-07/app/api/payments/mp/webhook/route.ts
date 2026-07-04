import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateOrderCommissions } from "@/lib/services/commissionService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { getPaymentById, type OrderType } from "@/lib/mercadopago";
import { ensureDigitalDelivery } from "@/lib/digital-delivery";
import { revokeOrderDownloadTokens } from "@/lib/download-tokens";
import { queueOrderConfirmationEmail, queuePhotographerOrderNotification, queuePhotographerPrintOrderNotification } from "@/lib/order-confirmation-email";
import { deliverOrderByWhatsApp } from "@/lib/whatsapp/sendOrderDelivery";
import { ensureWebhookIdempotency } from "@/lib/antifraud/webhook";
import { registerAuditEvent } from "@/lib/antifraud/audit";

const MIN_PAYOUT_PESOS_REF = 1;

/** Tras revertir earnings (reembolso), actualizar el monto de solicitudes de cobro PENDING del referidor. */
async function recalcPendingPayoutRequestsForReferrers(referrerUserIds: number[]) {
  const uniq = [...new Set(referrerUserIds)];
  for (const referrerUserId of uniq) {
    const agg = await prisma.referralEarning.aggregate({
      where: {
        attribution: { referrerUserId },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      _sum: { referralAmountCents: true },
    });
    const newCents = agg._sum.referralAmountCents ?? 0;
    const data: { amountCents: number; status?: string } = { amountCents: newCents };
    if (newCents < MIN_PAYOUT_PESOS_REF) data.status = "CANCELLED";
    await prisma.referralPayoutRequest.updateMany({
      where: { referrerUserId, status: "PENDING" },
      data,
    });
  }
}

/** Consume referral earnings del referidor para un descuento ya aplicado al fee de su venta (marca appliedAt). */
async function consumeReferralEarningsForDiscount(
  referrerUserId: number,
  discountCents: number,
  orderId: number,
  orderType: "PRINT_ORDER" | "ALBUM_ORDER"
) {
  if (discountCents <= 0) return;
  const earnings = await prisma.referralEarning.findMany({
    where: {
      attribution: { referrerUserId },
      paidOutAt: null,
      reversedAt: null,
      appliedAt: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, referralAmountCents: true },
  });
  let remaining = discountCents;
  const now = new Date();
  for (const e of earnings) {
    if (remaining <= 0) break;
    await prisma.referralEarning.update({
      where: { id: e.id },
      data: {
        appliedAt: now,
        appliedToOrderId: orderId,
        appliedToOrderType: orderType,
      },
    });
    remaining -= e.referralAmountCents;
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const pay = await getPaymentById(String(paymentId), { accessTokenOverride });

    let orderId = Number(pay.external_reference);
    // Si external_reference tiene formato "PREFIX:123", extraer el número
    if (!Number.isFinite(orderId) && pay.external_reference?.includes(":")) {
      const match = pay.external_reference.match(/:(\d+)$/);
      if (match) orderId = Number(match[1]);
    }
    const status = pay.status;
    let orderType = (pay.metadata?.orderType || orderTypeFromQuery) as OrderType | undefined;
    // Fallback: inferir orderType buscando en cada tabla cuando metadata/query faltan
    if (!orderType && Number.isFinite(orderId)) {
      const [albumOrder, printOrder, precompraOrder] = await Promise.all([
        prisma.order.findUnique({ where: { id: orderId }, select: { id: true } }),
        prisma.printOrder.findUnique({ where: { id: orderId }, select: { id: true } }),
        prisma.preCompraOrder.findUnique({ where: { id: orderId }, select: { id: true } }),
      ]);
      if (albumOrder) orderType = "ALBUM_ORDER";
      else if (printOrder) orderType = "PRINT_ORDER";
      else if (precompraOrder) orderType = "PRECOMPRA_ORDER";
    }
    orderType = orderType || "PRINT_ORDER";

    // Idempotencia: si ya procesamos este paymentId, retornar ok sin reprocesar
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
      if (orderType === "PRECOMPRA_ORDER") {
        if (status === "approved" || status === "rejected" || status === "cancelled") {
          await prisma.preCompraOrder.update({
            where: { id: orderId },
            data: { status: status === "approved" ? "PAID_HELD" : "CANCELED" },
          });
        }
      } else if (orderType === "ALBUM_ORDER") {
        if (status === "approved" || status === "rejected" || status === "cancelled") {
          const updateData: any = {
            status: status === "approved" ? "PAID" : "FAILED",
          };
          let orderWithItems: any | null = null;
          if (status === "approved") {
            const order = await prisma.order.findUnique({
              where: { id: orderId },
              include: {
                album: { select: { userId: true } },
                items: { select: { productType: true } },
              },
            });
            orderWithItems = order;
            if (order) {
              const percent = await resolvePlatformCommissionPercent({
                photographerId: order.album?.userId ?? null,
              });
              const extensionSurchargeCents = Number(order.extensionSurchargeCents ?? 0);
              const baseTotalCents = Math.max(0, order.totalCents - extensionSurchargeCents);
              const baseCommission = feeFromTotal(baseTotalCents, percent);
              // Extensión de almacenamiento: 100% para la plataforma (no multiplicador)
              updateData.platformCommissionCents = baseCommission + extensionSurchargeCents;
              await ensureDigitalDelivery(orderId);
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
          if (status === "approved") {
            const targetAlbumId = (orderWithItems as { albumId?: number })?.albumId;
            await registerAuditEvent({
              targetOrderType: "ALBUM_ORDER",
              targetOrderId: orderId,
              targetAlbumId,
              eventType: "PAYMENT_APPROVED",
            });
            await registerAuditEvent({
              targetOrderType: "ALBUM_ORDER",
              targetOrderId: orderId,
              targetAlbumId,
              eventType: "CUSTOMER_DATA_RELEASED",
            });
            await registerAuditEvent({
              targetOrderType: "ALBUM_ORDER",
              targetOrderId: orderId,
              targetAlbumId,
              eventType: "ORDER_ITEMS_RELEASED",
            });
            if (orderWithItems?.album?.userId && Number(updateData?.platformCommissionCents ?? 0) > 0) {
              const photographerId = orderWithItems.album.userId;
              const platformFeeCents = Number(updateData.platformCommissionCents);
              const attribution = await prisma.referralAttribution.findFirst({
                where: {
                  referredUserId: photographerId,
                  status: "ACTIVE",
                  endsAt: { gt: new Date() },
                },
                include: {
                  referrerUser: {
                    select: { mpUserId: true, mpConnectedAt: true },
                  },
                },
              });
              const referrerHasMp = !!(attribution?.referrerUser?.mpUserId || attribution?.referrerUser?.mpConnectedAt);
              if (attribution && referrerHasMp) {
                const saleRef = `ALBUM_ORDER:${orderId}`;
                const existing = await prisma.referralEarning.findFirst({
                  where: { saleRef },
                  select: { id: true },
                });
                if (!existing) {
                  const referralAmountCents = Math.floor(platformFeeCents * 0.5);
                  const platformNetCents = platformFeeCents - referralAmountCents;
                  await prisma.referralEarning.create({
                    data: {
                      attributionId: attribution.id,
                      paymentId: String(paymentId),
                      saleRef,
                      platformFeeCents,
                      referralAmountCents,
                      platformNetCents,
                    },
                  });
                }
              }
            }
            const referralFeeDiscountCentsAlbum = Number((orderWithItems as any)?.referralFeeDiscountCents ?? 0);
            if (referralFeeDiscountCentsAlbum > 0 && orderWithItems?.album?.userId) {
              await consumeReferralEarningsForDiscount(
                orderWithItems.album.userId,
                referralFeeDiscountCentsAlbum,
                orderId,
                "ALBUM_ORDER"
              );
            }
            queueOrderConfirmationEmail(orderId).catch((err) =>
              console.error("Error encolando email de confirmación de pedido:", err)
            );
            // Entrega por WhatsApp (complementa el email, no lo reemplaza)
            deliverOrderByWhatsApp(orderId).catch((err) =>
              console.error("Error en entrega WhatsApp post-compra:", err)
            );
            const hasPrintItems =
              Array.isArray(orderWithItems?.items) &&
              orderWithItems.items.some((it: any) => it?.productType === "PRINT");
            if (!hasPrintItems) {
              queuePhotographerOrderNotification(orderId).catch((err) =>
                console.error("Error encolando email al fotógrafo (nuevo pedido):", err)
              );
            }
            // Si hay PrintOrder espejo (pedido álbum con impresión), marcarlo como pagado
            try {
              const tag = `ALBUM_ORDER:${orderId}`;
              await prisma.printOrder.updateMany({
                where: { tags: { has: tag } },
                data: {
                  paymentStatus: "PAID",
                  mpPaymentId: String(paymentId),
                  statusUpdatedAt: new Date(),
                },
              });
              if (hasPrintItems) {
                const mirror = await prisma.printOrder.findFirst({
                  where: { tags: { has: tag } },
                  select: { id: true },
                });
                if (mirror?.id) {
                  queuePhotographerPrintOrderNotification(mirror.id).catch((err) =>
                    console.error("Error encolando email al fotógrafo (pedido impresión):", err)
                  );
                } else {
                  queuePhotographerOrderNotification(orderId).catch((err) =>
                    console.error("Error encolando email al fotógrafo (nuevo pedido):", err)
                  );
                }
              }
            } catch (err: any) {
              console.error("Error actualizando PrintOrder espejo (PAID):", err);
            }
          } else if (status === "rejected" || status === "cancelled") {
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
          // Reembolso o contracargo: marcar pedido, revocar descargas y revertir comisión de referidor
          try {
            await prisma.order.update({
              where: { id: orderId },
              data: { status: "REFUNDED" },
            });
          } catch (err: any) {
            console.error("Error actualizando Order a REFUNDED:", err);
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
                mpPaymentId: String(paymentId),
                statusUpdatedAt: new Date(),
              },
            });
          } catch (err: any) {
            console.error("Error actualizando PrintOrder espejo (REFUNDED):", err);
          }
          try {
            await prisma.referralEarning.updateMany({
              where: { saleRef: `ALBUM_ORDER:${orderId}` },
              data: { reversedAt: new Date() },
            });
            const reversed = await prisma.referralEarning.findMany({
              where: { saleRef: `ALBUM_ORDER:${orderId}` },
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
            console.error("Error revirtiendo ReferralEarning (ALBUM_ORDER reembolso):", err);
          }
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
            select: { photographerId: true, labId: true, pricingSnapshot: true, total: true, referralFeeDiscountCents: true },
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
            const attribution = await prisma.referralAttribution.findFirst({
              where: {
                referredUserId: printOrderForRef.photographerId,
                status: "ACTIVE",
                endsAt: { gt: new Date() },
              },
              include: {
                referrerUser: {
                  select: { mpUserId: true, mpConnectedAt: true },
                },
              },
            });
            const referrerHasMp = !!(attribution?.referrerUser?.mpUserId || attribution?.referrerUser?.mpConnectedAt);
            if (!attribution) {
              console.warn("WEBHOOK: Referido no creado – sin atribución activa", { orderId, photographerId: printOrderForRef.photographerId });
            } else if (!referrerHasMp) {
              console.warn("WEBHOOK: Referido no creado – referrer sin MP", { orderId, attributionId: attribution.id });
            } else {
              const saleRef = `PRINT_ORDER:${orderId}`;
              const existing = await prisma.referralEarning.findFirst({
                where: { saleRef },
                select: { id: true },
              });
              if (!existing) {
                // 50% del fee para el referidor, 50% para la plataforma. La plataforma ya cobró el 100% del fee
                // en la preferencia; el pago al referidor se hace por otro canal (ver REFERRAL_PAYOUTS.md).
                const referralAmountCents = Math.floor(platformFeeCentsPrint * 0.5);
                const platformNetCents = platformFeeCentsPrint - referralAmountCents;
                console.log("WEBHOOK: Creando ReferralEarning", {
                  orderId,
                  orderType: "PRINT_ORDER",
                  attributionId: attribution.id,
                  platformFeeCentsPrint,
                  referralAmountCents,
                  platformNetCents,
                });
                await prisma.referralEarning.create({
                  data: {
                    attributionId: attribution.id,
                    paymentId: String(paymentId),
                    saleRef,
                    platformFeeCents: platformFeeCentsPrint,
                    referralAmountCents,
                    platformNetCents,
                  },
                });
              }
            }
            const referralFeeDiscountCentsPrint = Number(printOrderForRef?.referralFeeDiscountCents ?? 0);
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
