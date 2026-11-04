/**
 * Promo "llevá N por $X" de la tienda (puro: lo usan el carrito, para mostrar, y el pedido, para
 * cobrar).
 *
 * Las unidades elegibles (productos de la categoría de la promo, mezclando diseños, modelos y
 * talles) se ordenan de mayor a menor precio y se agrupan de a `qty`. Cada grupo completo paga
 * `priceMinor`, salvo que su suma ya sea menor (la promo nunca encarece). Las que sobran pagan
 * precio de lista. Con 2 por $60.000 y remeras de $35.000: 3 remeras = 60.000 + 35.000.
 */

export type BundlePromo = { qty: number; priceMinor: number };

/** La promo que se muestra en la tienda: además del cálculo, la categoría y el texto. */
export type StoreBundle = BundlePromo & { categoryId: string; label: string };

export type BundleUnits = { unitPriceMinor: number; qty: number };

export type BundleResult = { discountMinor: number; groups: number };

const SIN_DESCUENTO: BundleResult = { discountMinor: 0, groups: 0 };

/** ¿La promo está bien formada? Una a medio cargar (o vieja) no descuenta nada. */
export function isValidBundlePromo(promo: BundlePromo | null | undefined): promo is BundlePromo {
  return (
    !!promo &&
    Number.isInteger(promo.qty) &&
    promo.qty >= 2 &&
    Number.isInteger(promo.priceMinor) &&
    promo.priceMinor > 0
  );
}

export function computeBundleDiscount(
  promo: BundlePromo | null | undefined,
  units: readonly BundleUnits[],
): BundleResult {
  if (!isValidBundlePromo(promo)) return SIN_DESCUENTO;
  const precios: number[] = [];
  for (const u of units) {
    if (!Number.isInteger(u.qty) || u.qty <= 0 || !Number.isFinite(u.unitPriceMinor) || u.unitPriceMinor < 0) continue;
    for (let i = 0; i < u.qty; i++) precios.push(u.unitPriceMinor);
  }
  precios.sort((a, b) => b - a);
  let discountMinor = 0;
  let groups = 0;
  for (let i = 0; i + promo.qty <= precios.length; i += promo.qty) {
    let suma = 0;
    for (let j = i; j < i + promo.qty; j++) suma += precios[j]!;
    const paga = Math.min(promo.priceMinor, suma);
    discountMinor += suma - paga;
    groups++;
  }
  return { discountMinor, groups };
}

/** El texto de la promo: el que cargó el negocio o "Llevá 2 por $60.000". */
export function bundleLabel(
  promo: BundlePromo & { label?: string | null },
  formatMinor: (minor: number) => string,
): string {
  const propio = promo.label?.trim();
  if (propio) return propio;
  return `Llevá ${promo.qty} por ${formatMinor(promo.priceMinor)}`;
}

/**
 * La promo como la ve el navegador: sólo para mostrar (el servidor recalcula al crear el pedido).
 * `productIds` son los productos de la tienda que entran (los de la categoría de la promo).
 */
export type ClientBundle = BundlePromo & { label: string; productIds: string[] };
