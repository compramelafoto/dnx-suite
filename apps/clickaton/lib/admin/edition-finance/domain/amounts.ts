/**
 * Definición canónica de importes (Etapa 5).
 *
 * - grossAmount: precio de fase antes del descuento (minor units).
 * - discountAmount: promoción aplicada.
 * - chargedAmount: importe final pagado por el participante (= gross - discount).
 * - providerFee: comisión Mercado Pago (estimada o confirmada).
 * - platformFee: comisión DNX/Clickatón (0 en AR 2026 salvo config explícita).
 * - distributableAmount: base para % (= chargedAmount - providerFee - platformFee).
 * - allocationAmount: importe asignado a cada beneficiario sobre distributableAmount.
 *
 * Decisión AR 2026: Tammy 100% del importe distribuible después de fees del proveedor.
 */

export type MoneyBreakdown = {
  currency: string;
  grossAmount: number;
  discountAmount: number;
  chargedAmount: number;
  providerFee: number;
  platformFee: number;
  distributableAmount: number;
};

export function buildMoneyBreakdown(input: {
  currency: string;
  grossAmount: number;
  discountAmount: number;
  providerFee?: number;
  platformFee?: number;
}): MoneyBreakdown {
  const discountAmount = Math.max(0, Math.min(input.discountAmount, input.grossAmount));
  const chargedAmount = Math.max(0, input.grossAmount - discountAmount);
  const providerFee = Math.max(0, input.providerFee ?? 0);
  const platformFee = Math.max(0, input.platformFee ?? 0);
  const distributableAmount = Math.max(0, chargedAmount - providerFee - platformFee);
  return {
    currency: input.currency,
    grossAmount: input.grossAmount,
    discountAmount,
    chargedAmount,
    providerFee,
    platformFee,
    distributableAmount,
  };
}
