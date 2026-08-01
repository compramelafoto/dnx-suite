import type {
  StoreCartTotals,
  StoreCartValidatedLine,
} from "@/lib/public-store/cart/types";

/** Subtotal de línea en minor units (enteros). */
export function lineSubtotalMinor(unitPriceMinor: number, quantity: number): number {
  const price = Number.isInteger(unitPriceMinor) ? Math.max(0, unitPriceMinor) : 0;
  const qty = Number.isInteger(quantity) ? Math.max(0, quantity) : 0;
  return price * qty;
}

export function computeStoreCartTotals(
  lines: readonly StoreCartValidatedLine[],
  currency = "ARS",
): StoreCartTotals {
  let subtotalMinor = 0;
  let validUnitCount = 0;
  let requestedUnitCount = 0;
  let validLineCount = 0;
  let issueCount = 0;

  for (const line of lines) {
    requestedUnitCount += Math.max(0, line.requestedQuantity);
    if (line.contributesToSubtotal) {
      subtotalMinor += line.lineSubtotalMinor;
      validUnitCount += Math.max(0, line.quantity);
      validLineCount += 1;
    }
    if (line.status !== "valid") {
      issueCount += 1;
    }
  }

  return {
    currency,
    subtotalMinor,
    validUnitCount,
    requestedUnitCount,
    validLineCount,
    issueCount,
  };
}

/** Líneas que pueden alimentar un futuro checkout (Etapa 05). */
export function contributingStoreCartLines(
  lines: readonly StoreCartValidatedLine[],
): StoreCartValidatedLine[] {
  return lines.filter((l) => l.contributesToSubtotal);
}
