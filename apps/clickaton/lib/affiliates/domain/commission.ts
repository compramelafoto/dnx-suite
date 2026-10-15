/**
 * Cálculo de la comisión del fotógrafo afiliado. Montos en centavos.
 *
 * - La comisión se calcula sobre el precio de lista de la inscripción (antes del
 *   descuento y sin el envío del kit).
 * - La comisión de Mercado Pago la absorben ambas partes en proporción a lo que
 *   recibe cada una: al fotógrafo se le descuenta su parte acá y DNX absorbe el
 *   resto cuando MP le cobra sobre lo que le queda.
 * - Al fotógrafo le va el neto como monto fijo; el dueño se lleva el resto.
 */

export type AffiliateCommissionInput = {
  /** Precio de lista de la inscripción (subtotal − envío). */
  baseAmount: number;
  /** Porcentaje de comisión en puntos básicos (1000 = 10%). 1..10000. */
  commissionBps: number;
  /** Comisión de MP en puntos básicos. 0..10000. */
  mpFeeBps: number;
  /** Lo que efectivamente paga el participante (con descuento y envío). */
  totalAmount: number;
};

export type AffiliateCommission = {
  grossAmount: number;
  mpFeeShareAmount: number;
  netAmount: number;
  ownerAmount: number;
  /**
   * Si se puede repartir en el mismo cobro. Con un código del 100% (o un total
   * menor que la comisión) no hay de dónde sacarla: se anota y se paga a mano.
   */
  splittable: boolean;
};

export class AffiliateCommissionInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AffiliateCommissionInputError";
  }
}

function assertNonNegativeInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AffiliateCommissionInputError(`${name} debe ser un entero no negativo.`);
  }
}

export function computeAffiliateCommission(
  input: AffiliateCommissionInput,
): AffiliateCommission {
  assertNonNegativeInt("baseAmount", input.baseAmount);
  assertNonNegativeInt("totalAmount", input.totalAmount);
  assertNonNegativeInt("commissionBps", input.commissionBps);
  assertNonNegativeInt("mpFeeBps", input.mpFeeBps);
  if (input.commissionBps < 1 || input.commissionBps > 10_000) {
    throw new AffiliateCommissionInputError("commissionBps debe estar entre 1 y 10000.");
  }
  if (input.mpFeeBps > 10_000) {
    throw new AffiliateCommissionInputError("mpFeeBps debe estar entre 0 y 10000.");
  }

  const grossAmount = Math.round((input.baseAmount * input.commissionBps) / 10_000);
  const mpFeeShareAmount = Math.round((grossAmount * input.mpFeeBps) / 10_000);
  const netAmount = grossAmount - mpFeeShareAmount;
  const ownerAmount = input.totalAmount - netAmount;

  return {
    grossAmount,
    mpFeeShareAmount,
    netAmount,
    ownerAmount,
    splittable: netAmount > 0 && ownerAmount > 0,
  };
}
