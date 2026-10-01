/**
 * Conversión de un importe de factura a pesos reales.
 *
 * Todo se maneja en unidades menores enteras (centavos) para que no haya
 * arrastre de coma flotante. NO se usa el sufijo "Cents": en el esquema de la
 * base ese sufijo no es confiable y se presta a confusión.
 */

export type ExpenseCurrency = "USD" | "ARS";

export type ExpenseAmountInput = {
  /** Importe de la factura en unidades menores de SU moneda. */
  amountOriginalMinor: number;
  currency: ExpenseCurrency;
  /** Pesos por dólar del mes. Obligatorio si la moneda es USD. */
  fxRate: number | null;
  /** Impuestos sobre el consumo en dólares, en porcentaje. */
  taxPercent: number;
};

export function computeAmountArsMinor(input: ExpenseAmountInput): number {
  if (input.currency === "ARS") return Math.round(input.amountOriginalMinor);

  if (input.fxRate == null) {
    throw new Error(
      "Falta el tipo de cambio: una factura en dólares no se puede convertir a pesos sin él.",
    );
  }

  const conImpuestos = input.amountOriginalMinor * input.fxRate * (1 + input.taxPercent / 100);
  return Math.round(conImpuestos);
}
