import { CheckoutPaymentSource, OrderOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createPreference,
  mercadoPagoAccessTokenIsTestCredential,
  mercadoPagoCheckoutUrlLooksLikeSandbox,
} from "@/lib/mercadopago";
import {
  checkoutKindFromOrderOrigin,
  readPackDefinitionIdFromOrderPricingSnapshot,
} from "@/lib/preventa-canjeable/order-checkout-kind";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { buildAlbumOrderMercadoPagoCheckoutSplit } from "@/lib/event-organizer-commission-mp-checkout";
import { bloqueaCheckoutPro } from "@/lib/split-1n-piloto/snapshot";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { applyAndPersistSellerReferralDiscount } from "@/lib/referral/referral-marketplace-fee";
import { scheduleCheckoutFeeShadowCompare } from "@/lib/pricing/checkout-fee-shadow";
import { resolveAlbumOrderMercadoPagoCredentials } from "@/lib/mercadopago/resolve-album-order-mp-credentials";
import { buildMercadoPagoUnauthorizedRefresher } from "@/lib/mercadopago/mp-oauth-token-refresh";
import { intlCollectorAllowed, shouldUseIntlFlow } from "@/lib/international/intl-order";
import { buildIntlPreferenceInput } from "@/lib/international/intl-preference";

const LOG_BLOCKED = "[TEST_CHECKOUT] blocked real payment flow";

export type EnsureAlbumOrderMpPreferenceResult =
  | {
      ok: true;
      initPoint: string;
      reused: boolean;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      httpStatus: number;
    };

function mpInitPointMatchesCredential(initPoint: string, accessToken: string): boolean {
  const urlIsSandbox = mercadoPagoCheckoutUrlLooksLikeSandbox(initPoint);
  const tokenIsTest = mercadoPagoAccessTokenIsTestCredential(accessToken);
  return urlIsSandbox === tokenIsTest;
}

async function resolveAlbumOrderMpAccessToken(
  albumUserId: number | null,
  eventId: number | null | undefined
): Promise<
  | {
      ok: true;
      accessTokenOverride: string;
      collectorType: "PHOTOGRAPHER" | "ORGANIZER";
      collectorUserId: number;
    }
  | { ok: false; error: string; code: string }
> {
  const creds = await resolveAlbumOrderMercadoPagoCredentials({
    photographerUserId: albumUserId,
    eventId,
  });
  if (!creds.ok) {
    return { ok: false, error: creds.error, code: creds.code };
  }
  return {
    ok: true,
    accessTokenOverride: creds.accessToken,
    collectorType: creds.collectorType,
    collectorUserId: creds.collectorUserId,
  };
}

type AlbumOrderForCheckoutLine = NonNullable<Awaited<ReturnType<typeof loadAlbumOrderForCheckout>>>;
type AlbumForCheckoutLine = { userId: number | null; eventId: number | null; selectedLabId: number | null } | null;

async function loadAlbumOrderForCheckout(orderId: number) {
  return prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
}

/**
 * Monto y comisión de UN pedido de álbum para Checkout Pro (fee de plataforma, descuento de
 * referidos y parte del organizador). Lo usan la preferencia del pedido suelto y la del grupo de
 * preventa (varios packs en un pago), que suma la comisión de cada pedido.
 */
export async function computeAlbumOrderCheckoutLine(
  order: AlbumOrderForCheckoutLine,
  album: AlbumForCheckoutLine,
  collectorType: "PHOTOGRAPHER" | "ORGANIZER"
): Promise<{
  title: string;
  total: number;
  marketplaceFee: number;
  component: "PRINT" | "DIGITAL";
  packDefFromSnap: number | null;
}> {
  const orderId = order.id;
  const title =
    order.origin === OrderOrigin.PREVENTA_PACK
      ? `Preventa pack - Pedido #${order.id}`
      : `Compra de fotos - Pedido #${order.id}`;
  const total = order.totalCents;

  let marketplaceFeeCentsAlbum = Number((order.pricingSnapshot as Record<string, unknown> | null)?.marketplaceFeeCents ?? 0) || 0;
  if (marketplaceFeeCentsAlbum <= 0 && order.totalCents) {
    const snap = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
    const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
    if (pct > 0) marketplaceFeeCentsAlbum = feeFromTotal(Number(order.totalCents), pct);
  }

  let marketplaceFee = Math.round(marketplaceFeeCentsAlbum);
  const hasPrint = order.items.some((it) => it.productType === "PRINT");
  const component = hasPrint ? ("PRINT" as const) : ("DIGITAL" as const);
  const photographerIdAlbum = album?.userId ?? null;

  let referralDiscountCentsAlbum = 0;
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
    paymentCollectorType: collectorType,
  });
  marketplaceFee = checkoutSplit.marketplaceFeePesos;

  const packDefFromSnap = readPackDefinitionIdFromOrderPricingSnapshot(order.pricingSnapshot);
  return { title, total, marketplaceFee, component, packDefFromSnap };
}

/**
 * Crea o reutiliza la preferencia de Mercado Pago para un pedido de álbum (ALBUM_ORDER).
 */
export async function ensureAlbumOrderMpPreference(
  orderId: number,
  options?: { forceRegenerate?: boolean }
): Promise<EnsureAlbumOrderMpPreferenceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return { ok: false, error: "Pedido de álbum no encontrado", httpStatus: 404 };
  }

  if (order.isTest || order.checkoutPaymentSource === CheckoutPaymentSource.SIMULATED) {
    console.info(LOG_BLOCKED, {
      reason: "album_order_simulated_or_test",
      orderId,
      isTest: order.isTest,
      checkoutPaymentSource: order.checkoutPaymentSource,
    });
    return {
      ok: false,
      error: "Este pedido es de simulación; no se crea preferencia de Mercado Pago.",
      code: "SIMULATED_ORDER",
      httpStatus: 400,
    };
  }

  // Piloto Split 1:N: el pedido se cobra con tarjeta en /pagar y ese cobro puede estar en curso.
  // Checkout Pro sólo después de que el comprador eligió «Pagar con Mercado Pago» (plan B).
  if (bloqueaCheckoutPro(order.pricingSnapshot)) {
    console.info(LOG_BLOCKED, { reason: "album_order_split_1n_piloto", orderId });
    return {
      ok: false,
      error: "Esta compra se paga desde su página de pago.",
      code: "SPLIT_1N_PILOTO",
      httpStatus: 409,
    };
  }

  // Varios packs de preventa en un solo pago: si el pedido está en un grupo pendiente, se abre
  // el pago del grupo entero (reintentos, recordatorios). Si el grupo ya no se puede cobrar
  // junto (p. ej. otro pack se pagó aparte), sigue el pago de este pedido solo.
  if (
    order.origin === OrderOrigin.PREVENTA_PACK &&
    (order.status === "PENDING" || order.status === "FAILED")
  ) {
    const { buscarGrupoDelPedido, asegurarPreferenciaGrupo } = await import(
      "@/lib/preventa-canjeable/pago-grupo/servicio"
    );
    const grupo = await buscarGrupoDelPedido(orderId);
    if (grupo && grupo.status === "PENDING") {
      try {
        const pref = await asegurarPreferenciaGrupo(grupo.id, options);
        if (pref.ok) return { ok: true, initPoint: pref.initPoint, reused: pref.reused };
        console.info("[preventa-grupo] pago suelto en vez del grupo", { orderId, grupoId: grupo.id, codigo: pref.codigo });
      } catch (err: unknown) {
        console.error("[preventa-grupo] preferencia del grupo falló; sigue suelto", { orderId, grupoId: grupo.id, err: String(err) });
      }
    }
  }

  const album = await prisma.album.findUnique({
    where: { id: order.albumId },
    select: { userId: true, eventId: true, selectedLabId: true },
  });

  const tokenResult = await resolveAlbumOrderMpAccessToken(
    album?.userId ?? null,
    album?.eventId ?? null
  );
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: tokenResult.error,
      code: tokenResult.code,
      httpStatus: 400,
    };
  }

  const { accessTokenOverride, collectorType, collectorUserId } = tokenResult;

  // CLF internacional (piloto): moneda local, sin marketplace_fee, sin split ni referidos.
  // La comisión se descuenta del saldo en dólares del fotógrafo al confirmarse el pago.
  if (shouldUseIntlFlow(order.currency)) {
    if (!intlCollectorAllowed(collectorType)) {
      return {
        ok: false,
        error: "La venta de este álbum está pausada momentáneamente. Probá de nuevo más tarde.",
        code: "INTL_SALE_PAUSED",
        httpStatus: 409,
      };
    }
    if (
      !options?.forceRegenerate &&
      order.mpInitPoint &&
      order.mpPreferenceId &&
      mpInitPointMatchesCredential(order.mpInitPoint, accessTokenOverride)
    ) {
      return { ok: true, initPoint: order.mpInitPoint, reused: true };
    }
    const intlInput = buildIntlPreferenceInput(order);
    const intlPref = await createPreference(
      {
        title: intlInput.title,
        total: intlInput.total,
        currencyId: intlInput.currencyId,
        externalReference: intlInput.externalReference,
        metadata: { orderType: "ALBUM_ORDER", orderId, component: "DIGITAL", intl: true },
      },
      {
        accessTokenOverride,
        refreshAccessTokenOnUnauthorized: buildMercadoPagoUnauthorizedRefresher({
          ownerType: "USER",
          ownerId: collectorUserId,
        }),
      }
    );
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING", mpInitPoint: intlPref.initPoint, mpPreferenceId: intlPref.preferenceId },
    });
    return { ok: true, initPoint: intlPref.initPoint, reused: false };
  }

  if (
    !options?.forceRegenerate &&
    order.mpInitPoint &&
    order.mpPreferenceId &&
    mpInitPointMatchesCredential(order.mpInitPoint, accessTokenOverride)
  ) {
    return {
      ok: true,
      initPoint: order.mpInitPoint,
      reused: true,
    };
  }

  const { title, total, marketplaceFee, component, packDefFromSnap } = await computeAlbumOrderCheckoutLine(
    order,
    album,
    collectorType
  );

  const { initPoint, preferenceId } = await createPreference(
    {
      title,
      total,
      marketplaceFee,
      externalReference: String(orderId),
      metadata: {
        orderType: "ALBUM_ORDER",
        orderId,
        component,
        checkoutKind: checkoutKindFromOrderOrigin(order.origin),
        ...(packDefFromSnap != null ? { packDefinitionId: packDefFromSnap } : {}),
      },
    },
    {
      accessTokenOverride,
      refreshAccessTokenOnUnauthorized: buildMercadoPagoUnauthorizedRefresher({
        ownerType: "USER",
        ownerId: collectorUserId,
      }),
    }
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: "PENDING",
      mpInitPoint: initPoint,
      mpPreferenceId: preferenceId,
    },
  });

  return { ok: true, initPoint, reused: false };
}
