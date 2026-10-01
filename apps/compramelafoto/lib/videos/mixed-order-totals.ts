/**
 * Suma los videos a los totales de un pedido de fotos.
 *
 * Un pedido puede llevar fotos y videos juntos: el cliente elige todo, paga una
 * vez y lo descarga del mismo lugar. Por dentro las fotos y los videos viven en
 * tablas separadas, pero eso no tiene que notarse desde afuera.
 *
 * **La garantía de esta función**: sin videos devuelve exactamente los mismos
 * números que entraron. Eso es lo que permite llamarla desde el checkout de
 * fotos sin riesgo de cambiarle un peso a la venta que ya funciona.
 */

export type VideoQuoteTotals = {
  items: { videoId: number }[];
  clientTotalArs: number;
  feeTotalArs: number;
};

export type MixedTotalsInput = {
  /** Total de las fotos, en pesos enteros. */
  photoTotalArs: number;
  /** Fee de plataforma de las fotos, en pesos enteros. */
  photoMarketplaceFeeArs: number;
  videoQuote: VideoQuoteTotals | null;
};

export type MixedTotals = {
  totalArs: number;
  marketplaceFeeArs: number;
  hasVideos: boolean;
};

function safe(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function addVideosToOrderTotals(input: MixedTotalsInput): MixedTotals {
  const photoTotal = safe(input.photoTotalArs);
  const photoFee = safe(input.photoMarketplaceFeeArs);

  const quote = input.videoQuote;
  const hasVideos = Boolean(quote && quote.items.length > 0 && quote.clientTotalArs > 0);

  if (!hasVideos) {
    return {
      totalArs: Math.round(photoTotal),
      marketplaceFeeArs: Math.round(photoFee),
      hasVideos: false,
    };
  }

  const totalArs = Math.round(photoTotal + safe(quote!.clientTotalArs));
  // Tope duro: repartir más de lo cobrado deja el pedido en rojo y Mercado Pago
  // lo rechaza. Preferible recortar el fee que romper el pago.
  const marketplaceFeeArs = Math.min(
    Math.round(photoFee + safe(quote!.feeTotalArs)),
    totalArs
  );

  return { totalArs, marketplaceFeeArs, hasVideos: true };
}
