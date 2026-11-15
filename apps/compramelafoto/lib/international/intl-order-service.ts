import { CheckoutPaymentSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveUserMpAccessTokenDualRead } from "@/lib/mercadopago/financial-identity-dual-read";
import { currencyForMpSite, isIntlPilotUser } from "./pilot";
import { latestFxRate } from "./fx-store";
import { ensureAdvanceGranted, getWalletState } from "./wallet-store";
import {
  buildIntlSnapshot,
  canSellIntl,
  computeIntlDigitalTotals,
  intlBlockMessage,
  type IntlSaleBlock,
} from "./intl-order";

const MP_SITE_TTL_MS = 24 * 60 * 60 * 1000;
const mpSiteCache = new Map<number, { currency: string | null; at: number }>();

/** Moneda de la cuenta de Mercado Pago conectada (por su site_id). Se guarda 24 h en memoria. */
export async function mpAccountCurrency(
  userId: number,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const cached = mpSiteCache.get(userId);
  if (cached && Date.now() - cached.at < MP_SITE_TTL_MS) return cached.currency;
  try {
    const res = await fetchImpl("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { site_id?: string };
    const currency = currencyForMpSite(json.site_id);
    if (currency) mpSiteCache.set(userId, { currency, at: Date.now() });
    return currency;
  } catch {
    return null;
  }
}

export type IntlOrderItemInput = {
  fileKey: unknown;
  tipo?: unknown;
  size?: unknown;
  includedWithPrint?: boolean;
};

export type CreateIntlOrderResult =
  | { ok: false; status: number; body: { error: string; code: string } }
  | { ok: true; orderId: number; totalStored: number };

/**
 * Crea el pedido de un álbum en moneda local (piloto internacional): solo fotos digitales,
 * precio del álbum + 15 %. No pasa por el motor de precios argentino.
 */
export async function createIntlAlbumOrder(params: {
  album: { id: number; userId: number; currency: string; digitalPhotoPriceCents: number | null; eventId: number | null };
  items: IntlOrderItemInput[];
  photoIdForFileKey: (fileKey: string) => number | null;
  buyer: { email: string; userId: number | null; name: string | null; phone: string | null };
}): Promise<CreateIntlOrderResult> {
  const { album } = params;
  const paused = (block: IntlSaleBlock): CreateIntlOrderResult => {
    console.info("[intl-order] venta pausada", { albumId: album.id, userId: album.userId, block });
    return { ok: false, status: 409, body: { error: intlBlockMessage(block), code: "INTL_SALE_PAUSED" } };
  };

  const pilot = isIntlPilotUser(album.userId);
  if (!pilot) return paused("NOT_PILOT");

  const allDigital = params.items.every(
    (it) => (it.tipo === "digital" || it.size === "DIGITAL") && !it.includedWithPrint,
  );
  const photoIds = new Set<number>();
  for (const it of params.items) {
    const id = typeof it.fileKey === "string" ? params.photoIdForFileKey(it.fileKey) : null;
    if (id == null) {
      return { ok: false, status: 400, body: { error: "Una de las fotos ya no está disponible.", code: "PHOTO_NOT_FOUND" } };
    }
    photoIds.add(id);
  }

  await ensureAdvanceGranted(album.userId);
  // Misma lectura del token que usa la preferencia (incluye el depósito seguro de credenciales).
  const owner = await resolveUserMpAccessTokenDualRead(album.userId);
  const mpConnected = Boolean(owner.accessToken && owner.mpUserId);
  const mpCurrency = mpConnected ? await mpAccountCurrency(album.userId, owner.accessToken!) : null;
  const wallet = await getWalletState(album.userId);
  const fx = await latestFxRate(album.currency);

  const check = canSellIntl({
    pilot,
    mpConnected,
    mpCurrency,
    albumCurrency: album.currency,
    balanceUsdCents: wallet.balanceUsdCents,
    hasFx: fx != null,
    allDigital,
    unitPriceStored: album.digitalPhotoPriceCents,
    inEvent: album.eventId != null,
  });
  if (!check.ok) return paused(check.block);

  const unit = album.digitalPhotoPriceCents!;
  const totals = computeIntlDigitalTotals({ unitPriceStored: unit, photoCount: photoIds.size, currency: album.currency });
  const order = await prisma.order.create({
    data: {
      albumId: album.id,
      buyerEmail: params.buyer.email,
      buyerUserId: params.buyer.userId,
      buyerName: params.buyer.name,
      buyerPhone: params.buyer.phone,
      totalCents: totals.totalStored,
      currency: album.currency,
      platformCommissionCents: totals.commissionStored,
      status: "PENDING",
      checkoutPaymentSource: CheckoutPaymentSource.MERCADO_PAGO,
      pricingSnapshot: buildIntlSnapshot({
        currency: album.currency,
        subtotalStored: totals.subtotalStored,
        commissionStored: totals.commissionStored,
      }),
      items: {
        create: [...photoIds].map((photoId) => ({
          photoId,
          productType: "DIGITAL" as const,
          size: null,
          finish: null,
          quantity: 1,
          priceCents: unit,
          subtotalCents: unit,
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, orderId: order.id, totalStored: totals.totalStored };
}
