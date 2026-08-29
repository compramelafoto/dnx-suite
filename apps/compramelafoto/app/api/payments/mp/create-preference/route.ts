import { NextResponse } from "next/server";
import { CheckoutPaymentSource, OrderOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createPreference, type OrderType } from "@/lib/mercadopago";
import {
  checkoutKindFromOrderOrigin,
  readPackDefinitionIdFromOrderPricingSnapshot,
} from "@/lib/preventa-canjeable/order-checkout-kind";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { buildAlbumOrderMercadoPagoCheckoutSplit } from "@/lib/event-organizer-commission-mp-checkout";
import { resolveAlbumOrderMercadoPagoCredentials } from "@/lib/mercadopago/resolve-album-order-mp-credentials";
import { buildMercadoPagoUnauthorizedRefresher } from "@/lib/mercadopago/mp-oauth-token-refresh";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { logLegacyPreventaUsage } from "@/lib/observability/legacy-preventa-usage";
import { applyAndPersistSellerReferralDiscount } from "@/lib/referral/referral-marketplace-fee";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";

const LOG_BLOCKED = "[TEST_CHECKOUT] blocked real payment flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    const orderType = (body.orderType || "PRINT_ORDER") as OrderType;

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    let title: string;
    let total: number;
  let marketplaceFee: number | undefined;
  let component: "DIGITAL" | "PRINT" = "PRINT";
    let accessTokenOverride: string | undefined;
    let tokenSource = "global";
    /** Dueño del token OAuth, para poder renovarlo si Mercado Pago responde 401. */
    let mpTokenOwner: { ownerType: "USER" | "LAB"; ownerId: number } | null = null;
    let albumOrderForMpMeta: {
      origin: OrderOrigin;
      pricingSnapshot: unknown;
    } | null = null;

    if (orderType === "PRECOMPRA_ORDER") {
      const order = await prisma.preCompraOrder.findUnique({
        where: { id: orderId },
        include: { album: { select: { userId: true, selectedLabId: true } } },
      });

      if (!order) {
        logLegacyPreventaUsage({
          source: "legacy_precompra_order",
          route: "/api/payments/mp/create-preference",
          orderType: "PRECOMPRA_ORDER",
          orderId,
          preCompraOrderId: orderId,
          albumId: null,
          ok: false,
          httpStatus: 404,
        });
        return NextResponse.json({ error: "Pedido de pre-venta no encontrado" }, { status: 404 });
      }

      if (order.isTest) {
        console.info(LOG_BLOCKED, { reason: "precompra_order_is_test", orderId });
        return NextResponse.json(
          { error: "Este pedido es de simulación; no se crea preferencia de Mercado Pago.", code: "SIMULATED_ORDER" },
          { status: 400 }
        );
      }

      if (order.mpInitPoint && order.mpPreferenceId) {
        return NextResponse.json(
          {
            orderId,
            orderType,
            initPoint: order.mpInitPoint,
            preferenceId: order.mpPreferenceId,
            reused: true,
          },
          { status: 200 }
        );
      }

      const totalArs = Math.round(order.totalCents / 100);
      if (!totalArs || totalArs <= 0) {
        logLegacyPreventaUsage({
          source: "legacy_precompra_order",
          route: "/api/payments/mp/create-preference",
          orderType: "PRECOMPRA_ORDER",
          orderId,
          preCompraOrderId: order.id,
          albumId: order.albumId,
          ok: false,
          httpStatus: 400,
          reason: "invalid_total",
        });
        return NextResponse.json({ error: "El pedido tiene un total inválido" }, { status: 400 });
      }

      title = `Pre-venta escolar - Pedido #${order.id}`;
      total = totalArs;
      component = "PRINT";
      const platformPercent = await resolveClientMarketplaceFeePercent({
        photographerId: order.album?.userId ?? null,
        labId: order.album?.selectedLabId ?? null,
      });
      scheduleCheckoutFeeShadowCompare({
        site: "create-preference.precompra-school",
        legacyFeePercent: platformPercent,
        resolveInput: {
          component: "DIGITAL",
          flow: "PREVENTA_PACK",
          purpose: "MARKETPLACE_FEE_TOTAL",
          photographerId: order.album?.userId ?? null,
          labId: order.album?.selectedLabId ?? null,
          albumId: order.albumId,
          orderOrigin: "PREVENTA_PACK",
        },
        orderId: order.id,
        albumId: order.albumId,
        photographerId: order.album?.userId ?? null,
        labId: order.album?.selectedLabId ?? null,
        hasOrganizer: true,
        totalArsForEstimate: order.totalCents,
      });
      marketplaceFee = Math.round(feeFromTotal(order.totalCents, platformPercent) / 100);

      if (order.album?.userId) {
        const photographer = await prisma.user.findUnique({
          where: { id: order.album.userId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "user_oauth";
          mpTokenOwner = { ownerType: "USER", ownerId: order.album.userId };
        } else {
          logLegacyPreventaUsage({
            source: "legacy_precompra_order",
            route: "/api/payments/mp/create-preference",
            orderType: "PRECOMPRA_ORDER",
            orderId,
            preCompraOrderId: order.id,
            albumId: order.albumId,
            ok: false,
            httpStatus: 400,
            reason: "mp_not_connected",
          });
          return NextResponse.json(
            { error: "El dueño del álbum debe conectar Mercado Pago para recibir los pagos.", code: "MP_NOT_CONNECTED" },
            { status: 400 }
          );
        }
      }
    } else if (orderType === "PRINT_ORDER") {
      const order = await prisma.printOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Pedido de impresión no encontrado" }, { status: 404 });
      }

      if (!order.total || order.total <= 0) {
        console.error("CREATE PREFERENCE: Pedido con total inválido", { orderId, total: order.total });
        return NextResponse.json(
          { error: "El pedido tiene un total inválido", orderId, total: order.total },
          { status: 400 }
        );
      }

      if (order.mpInitPoint && order.mpPreferenceId) {
        return NextResponse.json(
          {
            orderId,
            orderType,
            initPoint: order.mpInitPoint,
            preferenceId: order.mpPreferenceId,
            reused: true,
          },
          { status: 200 }
        );
      }

      title = `Impresión de fotos - Pedido #${order.id}`;
      total = order.total;
    let marketplaceFeeCents = Number((order as any)?.pricingSnapshot?.marketplaceFeeCents ?? 0) || 0;
    if (marketplaceFeeCents <= 0 && order.total) {
      const snap = ((order as any).pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) marketplaceFeeCents = feeFromTotal(Number(order.total), pct);
    }
    marketplaceFee = Math.round(marketplaceFeeCents);
    component = "PRINT";
      const photographerIdPrint = order.photographerId ?? null;
      if (photographerIdPrint != null && marketplaceFeeCents > 0) {
        const referralDiscount = await applyAndPersistSellerReferralDiscount({
          sellerUserId: photographerIdPrint,
          marketplaceFeeCents,
          persist: { orderType: "PRINT_ORDER", orderId },
        });
        marketplaceFeeCents = referralDiscount.marketplaceFeeCents;
        marketplaceFee = Math.round(marketplaceFeeCents);
      }
      if (order.photographerId) {
        const photographer = await prisma.user.findUnique({
          where: { id: order.photographerId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "user_oauth";
          mpTokenOwner = { ownerType: "USER", ownerId: order.photographerId };
        }
      }
      if (!accessTokenOverride && order.labId != null) {
        const lab = await prisma.lab.findUnique({
          where: { id: order.labId },
          select: { mpAccessToken: true },
        });
        if (lab?.mpAccessToken) {
          accessTokenOverride = lab.mpAccessToken;
          tokenSource = "lab_oauth";
          mpTokenOwner = { ownerType: "LAB", ownerId: order.labId };
        }
      }
      // La plataforma siempre cobra el 100% del fee (marketplace_fee). La parte del referidor
      // se registra en ReferralEarning en el webhook y puede pagarse al referidor por otro medio
      // (MP solo permite split en 2 partes: vendedor + marketplace; no hay tercer receptor en la misma transacción).
    } else {
      // ALBUM_ORDER
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Pedido de álbum no encontrado" }, { status: 404 });
      }

      if (order.isTest || order.checkoutPaymentSource === CheckoutPaymentSource.SIMULATED) {
        console.info(LOG_BLOCKED, {
          reason: "album_order_simulated_or_test",
          orderId,
          isTest: order.isTest,
          checkoutPaymentSource: order.checkoutPaymentSource,
        });
        return NextResponse.json(
          { error: "Este pedido es de simulación; no se crea preferencia de Mercado Pago.", code: "SIMULATED_ORDER" },
          { status: 400 }
        );
      }

      if (order.mpInitPoint && order.mpPreferenceId) {
        return NextResponse.json(
          {
            orderId,
            orderType,
            initPoint: order.mpInitPoint,
            preferenceId: order.mpPreferenceId,
            reused: true,
          },
          { status: 200 }
        );
      }

      albumOrderForMpMeta = {
        origin: order.origin,
        pricingSnapshot: order.pricingSnapshot,
      };

      title =
        order.origin === OrderOrigin.PREVENTA_PACK
          ? `Preventa pack - Pedido #${order.id}`
          : `Compra de fotos - Pedido #${order.id}`;
      total = order.totalCents;
    let marketplaceFeeCentsAlbum = Number((order as any)?.pricingSnapshot?.marketplaceFeeCents ?? 0) || 0;
    if (marketplaceFeeCentsAlbum <= 0 && order.totalCents) {
      const snap = ((order as any).pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) marketplaceFeeCentsAlbum = feeFromTotal(Number(order.totalCents), pct);
    }
    marketplaceFee = Math.round(marketplaceFeeCentsAlbum);
    const hasPrint = order.items.some((it: any) => it.productType === "PRINT");
    component = hasPrint ? "PRINT" : "DIGITAL";
      const album = await prisma.album.findUnique({
        where: { id: order.albumId },
        select: { userId: true, eventId: true, selectedLabId: true },
      });
      const photographerIdAlbum = album?.userId ?? null;
      const mpCreds = await resolveAlbumOrderMercadoPagoCredentials({
        photographerUserId: photographerIdAlbum,
        eventId: album?.eventId ?? null,
      });
      if (!mpCreds.ok) {
        return NextResponse.json(
          {
            error: mpCreds.error,
            code: mpCreds.code,
          },
          { status: 400 }
        );
      }
      accessTokenOverride = mpCreds.accessToken;
      tokenSource =
        mpCreds.collectorType === "ORGANIZER" ? "event_organizer_oauth" : "user_oauth";
      mpTokenOwner = { ownerType: "USER", ownerId: mpCreds.collectorUserId };
      let referralDiscountCentsAlbum = 0;
      // Descontar saldo de referidos del dueño del álbum del fee de esta venta
      if (photographerIdAlbum != null && marketplaceFeeCentsAlbum > 0) {
        const referralDiscount = await applyAndPersistSellerReferralDiscount({
          sellerUserId: photographerIdAlbum,
          marketplaceFeeCents: marketplaceFeeCentsAlbum,
          persist: { orderType: "ALBUM_ORDER", orderId },
        });
        referralDiscountCentsAlbum = referralDiscount.discountCents;
        marketplaceFeeCentsAlbum = referralDiscount.marketplaceFeeCents;
        marketplaceFee = Math.round(marketplaceFeeCentsAlbum);
      }

      const platformPercentAlbum =
        !hasPrint || order.origin === OrderOrigin.PREVENTA_PACK
          ? await resolveClientMarketplaceFeePercent({
              photographerId: photographerIdAlbum,
              labId: album?.selectedLabId ?? null,
            })
          : await resolvePlatformCommissionPercent({
              photographerId: photographerIdAlbum,
              labId: album?.selectedLabId ?? null,
            });
      const feeFlow =
        order.origin === OrderOrigin.PREVENTA_PACK
          ? ("PREVENTA_PACK" as const)
          : order.origin === OrderOrigin.PACK_REDEMPTION
            ? ("PACK_REDEMPTION" as const)
            : ("ALBUM_ORDER" as const);
      scheduleCheckoutFeeShadowCompare({
        site: hasPrint
          ? "create-preference.album-order-mixed"
          : order.origin === OrderOrigin.PREVENTA_PACK
            ? "create-preference.preventa-pack"
            : "create-preference.album-order",
        legacyFeePercent: platformPercentAlbum,
        resolveInput: {
          component: hasPrint ? "PRINT" : "DIGITAL",
          flow: feeFlow,
          purpose: "ORGANIZER_BASE_EXTRACT",
          photographerId: photographerIdAlbum,
          labId: album?.selectedLabId ?? null,
          albumId: order.albumId,
          hasPrintItems: hasPrint,
          orderOrigin:
            order.origin === OrderOrigin.PREVENTA_PACK
              ? "PREVENTA_PACK"
              : order.origin === OrderOrigin.PACK_REDEMPTION
                ? "PACK_REDEMPTION"
                : "STANDARD_CHECKOUT",
        },
        orderId: order.id,
        albumId: order.albumId,
        photographerId: photographerIdAlbum,
        labId: album?.selectedLabId ?? null,
        hasPrintItems: hasPrint,
        hasOrganizer: album?.eventId != null,
        hasReferral: referralDiscountCentsAlbum > 0,
        totalArsForEstimate: order.totalCents,
      });
      const checkoutSplit = await buildAlbumOrderMercadoPagoCheckoutSplit({
        orderId,
        albumId: order.albumId,
        eventId: album?.eventId ?? null,
        totalPaidPesos: order.totalCents,
        extensionSurchargePesos: Number(order.extensionSurchargeCents ?? 0),
        platformPercent: platformPercentAlbum,
        marketplaceFeePlatformOnlyPesos: marketplaceFeeCentsAlbum,
        paymentCollectorType: mpCreds.collectorType,
      });
      marketplaceFee = checkoutSplit.marketplaceFeePesos;
    }

    console.log("CREATE PREFERENCE: Creando preferencia MP", {
      orderId,
      orderType,
      title,
      total,
      tokenSource,
    });

    // Crear preferencia usando la librería centralizada
    const packDefFromSnap = albumOrderForMpMeta
      ? readPackDefinitionIdFromOrderPricingSnapshot(albumOrderForMpMeta.pricingSnapshot)
      : null;

    const { initPoint, preferenceId } = await createPreference(
      {
        title,
        total,
        marketplaceFee,
        externalReference: String(orderId),
        metadata: {
          orderType,
          orderId,
          component,
          ...(albumOrderForMpMeta
            ? {
                checkoutKind: checkoutKindFromOrderOrigin(albumOrderForMpMeta.origin),
                ...(packDefFromSnap != null ? { packDefinitionId: packDefFromSnap } : {}),
              }
            : {}),
        },
      },
      {
        accessTokenOverride,
        ...(mpTokenOwner
          ? {
              refreshAccessTokenOnUnauthorized:
                buildMercadoPagoUnauthorizedRefresher(mpTokenOwner),
            }
          : {}),
      }
    );

    console.log("CREATE PREFERENCE: Preferencia creada exitosamente", {
      orderId,
      preferenceId,
      initPoint: initPoint?.substring(0, 50) + "...",
    });

    // Actualizar el pedido según su tipo
    if (orderType === "PRINT_ORDER") {
      await prisma.printOrder.update({
        where: { id: orderId },
        data: {
          paymentProvider: "MP",
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
          paymentStatus: "PENDING",
        },
      });
    } else if (orderType === "PRECOMPRA_ORDER") {
      const updatedPc = await prisma.preCompraOrder.update({
        where: { id: orderId },
        data: {
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
        },
        select: { id: true, albumId: true },
      });
      logLegacyPreventaUsage({
        source: "legacy_precompra_order",
        route: "/api/payments/mp/create-preference",
        orderType: "PRECOMPRA_ORDER",
        orderId,
        preCompraOrderId: updatedPc.id,
        albumId: updatedPc.albumId,
        externalReference: String(orderId),
        preferenceId,
        ok: true,
        httpStatus: 200,
        phase: "preference_persisted",
      });
    } else {
      // ALBUM_ORDER
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PENDING",
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
        },
      });
    }

    return NextResponse.json(
      {
        orderId,
        orderType,
        initPoint,
        preferenceId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("CREATE PREFERENCE ERROR >>>", err);
    const errorMessage = err?.message || String(err) || "Error desconocido";
    const errorStack = err?.stack || err?.toString() || "";
    const errorCode = err?.code || err?.name || "UNKNOWN_ERROR";
    console.error("CREATE PREFERENCE ERROR DETAILS:", {
      message: errorMessage,
      stack: errorStack.substring(0, 500),
      errorCode,
      errorType: typeof err,
      errString: String(err),
      err,
    });
    
    // Asegurar que siempre devolvemos JSON válido
    try {
      return NextResponse.json(
        { 
          error: "Error creando preferencia", 
          detail: errorMessage,
          code: errorCode,
          ...(process.env.NODE_ENV !== "production" && { stack: errorStack.substring(0, 500) })
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (jsonError: any) {
      // Si incluso el JSON falla, devolver texto plano pero con Content-Type JSON
      console.error("CRITICAL: Failed to create JSON error response:", jsonError);
      return new NextResponse(
        JSON.stringify({ 
          error: "Error creando preferencia", 
          detail: errorMessage 
        }),
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
}
