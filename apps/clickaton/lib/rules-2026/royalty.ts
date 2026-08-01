/**
 * Regalía fotógrafo Clickatón → ComprameLaFoto.
 * Individual: 20% del precio de producto efectivamente pagado.
 * Excluye ÚNICAMENTE shipping. No descontar fees/impresión/marco/packaging.
 * COLLECTIVE_PRODUCT → 0%.
 */

export type RoyaltyProductKind = "INDIVIDUAL" | "COLLECTIVE_PRODUCT";

export function computePhotographerRoyalty(input: {
  productKind: RoyaltyProductKind;
  productPaidAmountMinor: number;
  shippingPaidAmountMinor: number;
  royaltyBps?: number;
}): {
  royaltyBaseMinor: number;
  royaltyMinor: number;
  shippingExcludedMinor: number;
  buyerTotalMinor: number;
} {
  const product = Math.max(0, Math.trunc(input.productPaidAmountMinor));
  const shipping = Math.max(0, Math.trunc(input.shippingPaidAmountMinor));
  const bps =
    input.productKind === "COLLECTIVE_PRODUCT"
      ? 0
      : (input.royaltyBps ?? 2000);

  if (input.productKind === "COLLECTIVE_PRODUCT") {
    return {
      royaltyBaseMinor: product,
      royaltyMinor: 0,
      shippingExcludedMinor: shipping,
      buyerTotalMinor: product + shipping,
    };
  }

  const royaltyMinor = Math.trunc((product * bps) / 10_000);
  return {
    royaltyBaseMinor: product,
    royaltyMinor,
    shippingExcludedMinor: shipping,
    buyerTotalMinor: product + shipping,
  };
}
