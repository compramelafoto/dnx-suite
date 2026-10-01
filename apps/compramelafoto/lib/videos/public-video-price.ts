import { quoteVideoForCheckout } from "@/lib/videos/video-order-pricing";

/**
 * Precio de un video para mostrarle al cliente.
 *
 * Muestra **lo que va a pagar**, con el fee ya incluido: nunca el precio del
 * fotógrafo y después una sorpresa en el checkout. Tampoco expone el precio
 * base ni el fee, que son información del vendedor.
 */

export type PublicVideoPrice = {
  /** Lo que paga el cliente, en pesos enteros. `null` si no está en venta. */
  priceArs: number | null;
  /** Listo para mostrar: "$11.500". */
  priceLabel: string | null;
  purchasable: boolean;
};

export function publicVideoPrice(
  video: { priceCents: number; sellEnabled: boolean },
  feePercent: number
): PublicVideoPrice {
  if (!video.sellEnabled) {
    return { priceArs: null, priceLabel: null, purchasable: false };
  }

  const quote = quoteVideoForCheckout(video, feePercent);
  if (!quote.sellable) {
    return { priceArs: null, priceLabel: null, purchasable: false };
  }

  return {
    priceArs: quote.clientTotalArs,
    priceLabel: formatVideoPriceArs(quote.clientTotalArs),
    purchasable: true,
  };
}

/** "$11.500" — pesos argentinos, sin centavos, con punto de miles. */
export function formatVideoPriceArs(ars: number | null): string | null {
  if (ars == null || !Number.isFinite(ars) || ars <= 0) return null;
  return `$${Math.round(ars).toLocaleString("es-AR")}`;
}
