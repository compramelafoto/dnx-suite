import { NextRequest, NextResponse } from "next/server";
import { CheckoutPaymentSource, OrderOrigin, OrderStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { createPreference } from "@/lib/mercadopago";
import { isAlbumPackPaymentGloballyAllowedForAlbum } from "@/lib/album-packs/album-pack-feature-flags";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import {
  albumPackMpShadowCompareSite,
  resolveAlbumPackOrderMpContext,
} from "@/lib/album-packs/resolve-album-pack-order-mp-component";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { applyAndPersistSellerReferralDiscount } from "@/lib/referral/referral-marketplace-fee";
import { buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer } from "@/lib/event-organizer-commission-mp-checkout";
import { readAlbumPackCartDraftIdsFromSnapshot } from "@/lib/album-packs/album-pack-cart-payment-ref";
import {
  getAlbumPackNameFromSnapshot,
  getAlbumPackOrderSnapshotType,
  isAlbumPackOrderPricingSnapshot,
  readAlbumPackOrderSnapshotPricing,
} from "@/lib/album-packs/album-pack-order-snapshot-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { orderId: string } | Promise<{ orderId: string }>;

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

function getAccessGuestToken(req: NextRequest): string | null {
  const fromHeader = req.headers.get("x-guest-token");
  if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  const fromQuery = req.nextUrl.searchParams.get("guestToken");
  return fromQuery && fromQuery.trim() ? fromQuery.trim() : null;
}

function getDraftIdFromOrder(order: { preCompraPaymentRef: string | null; pricingSnapshot: unknown }): string | null {
  const ref = String(order.preCompraPaymentRef ?? "").trim();
  const prefix = "ALBUM_PACK_DRAFT:";
  if (ref.startsWith(prefix)) {
    const draftId = ref.slice(prefix.length).trim();
    if (draftId) return draftId;
  }
  const snap = order.pricingSnapshot;
  if (snap && typeof snap === "object") {
    const maybeDraftId = (snap as Record<string, unknown>).draftId;
    const draftId = String(maybeDraftId ?? "").trim();
    if (draftId) return draftId;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const p = await params;
    const orderId = Number.parseInt(String(p.orderId ?? "").trim(), 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "orderId inválido." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        albumId: true,
        buyerEmail: true,
        status: true,
        origin: true,
        checkoutPaymentSource: true,
        totalCents: true,
        extensionSurchargeCents: true,
        pricingSnapshot: true,
        preCompraPaymentRef: true,
        mpInitPoint: true,
        mpPreferenceId: true,
        items: {
          select: { productType: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order no encontrado." }, { status: 404 });
    }

    if (order.mpInitPoint && order.mpPreferenceId) {
      return NextResponse.json(
        {
          orderId: order.id,
          initPoint: order.mpInitPoint,
          preferenceId: order.mpPreferenceId,
          reused: true,
        },
        { status: 200 }
      );
    }

    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json({ error: "El order debe estar en estado PENDING." }, { status: 400 });
    }
    if (order.origin !== OrderOrigin.STANDARD_CHECKOUT) {
      return NextResponse.json({ error: "El order no corresponde al flujo esperado." }, { status: 400 });
    }
    if (order.checkoutPaymentSource !== CheckoutPaymentSource.MERCADO_PAGO) {
      return NextResponse.json({ error: "El order no tiene source de pago Mercado Pago." }, { status: 400 });
    }
    if (!order.pricingSnapshot || typeof order.pricingSnapshot !== "object") {
      return NextResponse.json({ error: "pricingSnapshot inválido." }, { status: 400 });
    }
    if (!isAlbumPackOrderPricingSnapshot(order.pricingSnapshot)) {
      return NextResponse.json(
        { error: "El order no fue generado desde AlbumPackOrderDraft." },
        { status: 400 }
      );
    }
    const snapshotType = getAlbumPackOrderSnapshotType(order.pricingSnapshot);
    if (!Number.isFinite(order.totalCents) || order.totalCents <= 0) {
      return NextResponse.json({ error: "El order debe tener totalCents mayor a 0." }, { status: 400 });
    }

    const authUser = await getAuthUser();
    const guestToken = getAccessGuestToken(req);
    const buyerByEmail = normalizeEmail(order.buyerEmail);
    const actorByEmail = normalizeEmail(authUser?.email);

    const cartDraftIds = readAlbumPackCartDraftIdsFromSnapshot(
      order.pricingSnapshot,
      order.preCompraPaymentRef
    );
    let guestAuthorized = false;
    if (cartDraftIds.length > 0) {
      const drafts = await prisma.albumPackOrderDraft.findMany({
        where: { id: { in: cartDraftIds } },
        select: {
          guestToken: true,
          buyerEmail: true,
        },
      });
      guestAuthorized = drafts.some(
        (draft) => !!(draft.guestToken && guestToken && draft.guestToken === guestToken)
      );
    }

    const ownerByEmail = !!actorByEmail && actorByEmail === buyerByEmail;
    if (!ownerByEmail && !guestAuthorized) {
      return NextResponse.json({ error: "No autorizado para este pedido." }, { status: 403 });
    }

    const album = await prisma.album.findUnique({
      where: { id: order.albumId },
      select: { userId: true, eventId: true, albumPackPayEnabled: true, selectedLabId: true },
    });

    if (!isAlbumPackPaymentGloballyAllowedForAlbum(album?.albumPackPayEnabled)) {
      return NextResponse.json(
        {
          error: "El pago de packs no está habilitado para este álbum.",
          code: "ALBUM_PACK_PAY_DISABLED",
        },
        { status: 403 }
      );
    }

    let accessTokenOverride: string | undefined;
    if (album?.userId) {
      const photographer = await prisma.user.findUnique({
        where: { id: album.userId },
        select: { mpAccessToken: true },
      });
      if (photographer?.mpAccessToken) {
        accessTokenOverride = photographer.mpAccessToken;
      } else {
        return NextResponse.json(
          {
            error:
              "El dueño del álbum debe conectar Mercado Pago para recibir los pagos.",
            code: "MP_NOT_CONNECTED",
          },
          { status: 400 }
        );
      }
    }

    const packName = getAlbumPackNameFromSnapshot(order.pricingSnapshot);
    const title = packName || "Pack de fotos";

    const snapPricing = readAlbumPackOrderSnapshotPricing(order.pricingSnapshot);
    let marketplaceFee = Math.round(Number(snapPricing.marketplaceFeeCents) || 0);
    if (marketplaceFee <= 0 && order.totalCents > 0) {
      const pct = Number(snapPricing.marketplaceFeePercent) || 0;
      if (pct > 0) {
        marketplaceFee = feeFromTotal(order.totalCents, pct);
      } else if (album?.userId) {
        const platformFeePercent = await resolveClientMarketplaceFeePercent({
          photographerId: album.userId,
          labId: album.selectedLabId ?? null,
        });
        if (platformFeePercent > 0) {
          marketplaceFee = feeFromTotal(order.totalCents, platformFeePercent);
        }
      }
    }

    let packReferralDiscountCents = 0;
    if (album?.userId && marketplaceFee > 0) {
      const referralDiscount = await applyAndPersistSellerReferralDiscount({
        sellerUserId: album.userId,
        marketplaceFeeCents: marketplaceFee,
        persist: { orderType: "ALBUM_ORDER", orderId: order.id },
      });
      packReferralDiscountCents = referralDiscount.discountCents;
      marketplaceFee = referralDiscount.marketplaceFeeCents;
    }

    const mpCtx = resolveAlbumPackOrderMpContext({
      items: order.items,
      pricingSnapshot: order.pricingSnapshot,
    });
    const { component: mpComponent, hasPrintItems: hasPrint, isMixedOrder } = mpCtx;

    const platformPercent = hasPrint
      ? await resolvePlatformCommissionPercent({
          photographerId: album?.userId ?? null,
          labId: album?.selectedLabId ?? null,
        })
      : await resolveClientMarketplaceFeePercent({
          photographerId: album?.userId ?? null,
          labId: album?.selectedLabId ?? null,
        });
    scheduleCheckoutFeeShadowCompare({
      site: albumPackMpShadowCompareSite(mpCtx),
      legacyFeePercent: platformPercent,
      resolveInput: {
        component: mpComponent,
        flow: "ALBUM_PACK",
        purpose: "ORGANIZER_BASE_EXTRACT",
        photographerId: album?.userId ?? null,
        labId: album?.selectedLabId ?? null,
        albumId: order.albumId,
        hasPrintItems: hasPrint,
        orderOrigin: "STANDARD_CHECKOUT",
        ...(isMixedOrder ? { fulfillmentKind: "MIXED" as const } : {}),
      },
      orderId: order.id,
      albumId: order.albumId,
      photographerId: album?.userId ?? null,
      labId: album?.selectedLabId ?? null,
      hasPrintItems: hasPrint,
      hasOrganizer: album?.eventId != null,
      hasReferral: packReferralDiscountCents > 0,
      totalArsForEstimate: order.totalCents,
    });
    marketplaceFee = await buildAlbumOrderMercadoPagoMarketplaceFeeWithEventOrganizer({
      orderId: order.id,
      albumId: order.albumId,
      eventId: album?.eventId ?? null,
      totalPaidPesos: order.totalCents,
      extensionSurchargePesos: Number(order.extensionSurchargeCents ?? 0),
      platformPercent,
      marketplaceFeePlatformOnlyPesos: marketplaceFee,
    });

    const { initPoint, preferenceId } = await createPreference(
      {
        title,
        total: Math.round(order.totalCents),
        marketplaceFee: marketplaceFee > 0 ? marketplaceFee : undefined,
        externalReference: String(order.id),
        metadata: {
          orderType: "ALBUM_ORDER",
          orderId: order.id,
          albumId: order.albumId,
          component: mpComponent,
          source: snapshotType || "ALBUM_PACK_ORDER_V2",
        },
      },
      { accessTokenOverride }
    );

    await prisma.order.update({
      where: { id: order.id },
      data: {
        mpInitPoint: initPoint,
        mpPreferenceId: preferenceId,
      },
    });

    return NextResponse.json(
      {
        orderId: order.id,
        initPoint,
        preferenceId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/album-pack-orders/[orderId]/create-payment-preference", err);
    return NextResponse.json(
      { error: "Error creando preferencia de pago para pack." },
      { status: 500 }
    );
  }
}
