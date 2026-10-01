import { feeFromBase, totalFromBase } from "@/lib/pricing/fee-formula";

/**
 * Precio de un video para el checkout.
 *
 * **La trampa de las unidades.** Las dos tablas usan el sufijo `Cents` para
 * cosas distintas:
 *
 * - `VideoAsset.priceCents` guarda **centavos reales**: $10.000 son 1.000.000.
 * - `Order.totalCents` y `OrderItem.priceCents` guardan **pesos enteros**, y el
 *   sufijo quedó por compatibilidad histórica: $10.000 son 10.000.
 *
 * Pasar el precio de un video a una orden sin convertir lo multiplica por 100.
 * Toda la conversión pasa por acá, una sola vez, y está cubierta por tests.
 *
 * El fee reusa `lib/pricing/fee-formula`, la misma de las fotos: el porcentaje
 * es un **recargo sobre el precio del fotógrafo**, no una quita. Con 15% sobre
 * $10.000, el fotógrafo cobra $10.000 y el cliente paga $11.500.
 */

/** Centavos por peso. Explícito para que no quede un 100 suelto en el código. */
export const VIDEO_PRICE_CENTS_PER_ARS = 100;

/** Pasa el precio guardado del video a los pesos enteros que usa la orden. */
export function videoBasePriceArs(video: { priceCents: number }): number {
  const cents = video.priceCents;
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Math.round(cents / VIDEO_PRICE_CENTS_PER_ARS);
}

export type VideoCheckoutQuote = {
  /** Lo que cobra el fotógrafo, en pesos enteros. */
  basePriceArs: number;
  /** Lo que queda para la plataforma, en pesos enteros. */
  feeArs: number;
  /** Lo que paga el cliente, en pesos enteros. */
  clientTotalArs: number;
  /** Un video sin precio no se puede cobrar. */
  sellable: boolean;
};

/**
 * Cotiza un video: lo que cobra el fotógrafo, el fee y lo que paga el cliente.
 *
 * El total se calcula con la fórmula compartida y el fee se deriva de la base,
 * así base + fee siempre cierra exactamente con el total.
 */
export function quoteVideoForCheckout(
  video: { priceCents: number },
  feePercent: number
): VideoCheckoutQuote {
  const basePriceArs = videoBasePriceArs(video);

  if (basePriceArs <= 0) {
    return { basePriceArs: 0, feeArs: 0, clientTotalArs: 0, sellable: false };
  }

  const clientTotalArs = totalFromBase(basePriceArs, feePercent);
  // Se deriva de la resta, no de un segundo redondeo: así la cuenta cierra
  // siempre, sin un peso de diferencia entre lo que paga el cliente y la suma
  // de lo que cobran las partes.
  const feeArs = clientTotalArs - basePriceArs;

  return {
    basePriceArs,
    feeArs,
    clientTotalArs,
    sellable: true,
  };
}

/** El fee teórico de un precio base, para mostrar en el panel del fotógrafo. */
export function videoFeePreviewArs(baseArs: number, feePercent: number): number {
  return feeFromBase(baseArs, feePercent);
}
