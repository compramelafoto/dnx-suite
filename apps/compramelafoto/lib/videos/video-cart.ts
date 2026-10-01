import { quoteVideoForCheckout } from "@/lib/videos/video-order-pricing";

/**
 * Cotización de un carrito de videos.
 *
 * Separa lo cobrable de lo que no, en vez de fallar todo junto: si el cliente
 * eligió tres videos y el fotógrafo sacó uno de la venta mientras compraba,
 * conviene cobrarle los dos válidos y decirle qué pasó con el tercero.
 *
 * Las razones de rechazo están escritas para mostrárselas al cliente.
 */

export type CartVideo = {
  id: number;
  title: string | null;
  /** Centavos reales, como los guarda VideoAsset. */
  priceCents: number;
  sellEnabled: boolean;
  isRemoved: boolean;
  processingStatus: string;
  expiresAt: Date;
};

export type QuotedVideoItem = {
  videoId: number;
  videoTitle: string | null;
  priceArs: number;
  feeArs: number;
  subtotalArs: number;
  feePercent: number;
};

export type RejectedVideo = {
  videoId: number;
  reason: string;
};

export type VideoCartQuote = {
  items: QuotedVideoItem[];
  rejected: RejectedVideo[];
  /** Lo que cobra el fotógrafo por todo el carrito. */
  photographerTotalArs: number;
  /** Lo que queda para la plataforma. */
  feeTotalArs: number;
  /** Lo que paga el cliente. */
  clientTotalArs: number;
  /** Sólo se puede ir a pagar si hay al menos un video cobrable. */
  payable: boolean;
};

/** Por qué este video no se puede vender ahora, o null si se puede. */
function rejectionReason(video: CartVideo, now: Date): string | null {
  if (video.isRemoved) return "ya no está disponible";
  if (video.processingStatus !== "READY") return "todavía se está procesando";
  if (video.expiresAt.getTime() <= now.getTime()) {
    return "venció y ya no está disponible";
  }
  if (!video.sellEnabled) return "no está a la venta";
  if (!Number.isFinite(video.priceCents) || video.priceCents <= 0) {
    return "no tiene precio configurado";
  }
  return null;
}

export function quoteVideoCart(
  videos: CartVideo[],
  feePercent: number,
  now: Date = new Date()
): VideoCartQuote {
  const items: QuotedVideoItem[] = [];
  const rejected: RejectedVideo[] = [];
  const vistos = new Set<number>();

  for (const video of videos) {
    // El mismo video dos veces en el carrito se cobra una sola vez: un archivo
    // digital no tiene sentido comprarlo por duplicado.
    if (vistos.has(video.id)) continue;
    vistos.add(video.id);

    const reason = rejectionReason(video, now);
    if (reason) {
      rejected.push({ videoId: video.id, reason });
      continue;
    }

    const quote = quoteVideoForCheckout(video, feePercent);
    items.push({
      videoId: video.id,
      videoTitle: video.title,
      priceArs: quote.basePriceArs,
      feeArs: quote.feeArs,
      subtotalArs: quote.clientTotalArs,
      feePercent,
    });
  }

  const photographerTotalArs = items.reduce((a, i) => a + i.priceArs, 0);
  const feeTotalArs = items.reduce((a, i) => a + i.feeArs, 0);
  const clientTotalArs = items.reduce((a, i) => a + i.subtotalArs, 0);

  return {
    items,
    rejected,
    photographerTotalArs,
    feeTotalArs,
    clientTotalArs,
    payable: items.length > 0 && clientTotalArs > 0,
  };
}
