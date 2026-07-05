/**
 * Conversión entre columnas legacy (*Cents) y campos *Ars del pricingSnapshot V1 (§1.8.1).
 *
 * Convención legacy en este repo: `Order.totalCents`, `OrderItem.priceCents`, `subtotalCents`,
 * `marketplaceFeeCents` son **ARS enteros** (pesos sin centavos). El sufijo "Cents" es histórico
 * (ver comentarios en prisma/schema.prisma).
 *
 * En **pricingSnapshot V1**, `basePriceArs`, `feeArs`, `clientPaysArs`, `totalClientPaidArs` usan
 * la misma unidad: **enteros en pesos ARS** (no centavos de peso).
 *
 * Estas funciones son identidad numérica redondeada; existen para un solo lugar de documentación
 * y para que el commit de integración checkout no repita la convención en cada archivo.
 */

export function orderMoneyToSnapshotArs(centsFieldValue: number): number {
  return Math.round(Number(centsFieldValue) || 0);
}

/** ARS enteros del snapshot → valor para columnas *Cents del Order/OrderItem. */
export function snapshotArsToOrderColumn(ars: number): number {
  return Math.round(Number(ars) || 0);
}
