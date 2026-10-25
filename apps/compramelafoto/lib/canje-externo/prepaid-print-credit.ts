/**
 * Crédito de impresas ya pagadas por fuera de la plataforma (canje externo).
 *
 * El fotógrafo cobró un combo en mano o por transferencia ("3 fotos impresas 15x21 con su
 * digital") y la familia elige las fotos en la galería de siempre. Este módulo toma los
 * totales del checkout normal (`computeCheckoutTotals`) y deja en $0 las primeras N
 * impresas del tamaño del combo, más el digital que viene incluido con cada una. Todo lo
 * que la familia sume por encima se cobra al precio normal.
 *
 * Función pura: el mismo cálculo corre en la cotización (lo que ve la familia) y al crear
 * el pedido (lo que se cobra), así no pueden diferir.
 */

import type { CheckoutTotals, CheckoutPricingItem } from "@/lib/pricing/pricing-engine";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { stripCartCopySuffix } from "@/lib/album-photo-ref";

export type PrepaidPrintCredit = {
  /** Cuántas impresas cubre el combo. */
  printUnits: number;
  /** Tamaño de las impresas del combo, p. ej. "15x21 cm". */
  size: string;
  /** El combo incluye el digital de cada foto impresa. */
  includesDigital: boolean;
};

export type CreditInputItem = {
  fileKey?: string | null;
  size?: string | null;
  includedWithPrint?: boolean;
};

export type AppliedPrepaidCredit = {
  totals: CheckoutTotals;
  /** Impresas efectivamente cubiertas (puede ser menos que el combo si eligió menos). */
  creditedPrintUnits: number;
  /** Lo que el combo descontó del total, en pesos. */
  discountArs: number;
  /** De ese descuento, la parte de los digitales incluidos con las impresas. */
  discountDigitalArs: number;
};

/** "15x21 cm", "15X21", "15 x 21" → "15x21". */
export function normalizePrintSize(size: string | null | undefined): string {
  return String(size ?? "")
    .toLowerCase()
    .replace(/[^0-9x]/g, "");
}

function keyOf(item: CreditInputItem | undefined): string {
  return stripCartCopySuffix(String(item?.fileKey ?? ""));
}

export function applyPrepaidPrintCredit(
  totals: CheckoutTotals,
  inputItems: CreditInputItem[],
  credit: PrepaidPrintCredit
): AppliedPrepaidCredit {
  const targetSize = normalizePrintSize(credit.size);
  let remaining = Math.max(0, Math.floor(credit.printUnits));
  const creditedKeys = new Set<string>();
  let discountPrint = 0;
  let discountDigital = 0;

  // Las impresas se cubren en el orden en que la familia las eligió.
  const ordered = [...totals.items].sort((a, b) => a.inputIndex - b.inputIndex);
  const byIndex = new Map<CheckoutPricingItem, CheckoutPricingItem>();

  for (const line of ordered) {
    let next = line;
    const source = inputItems[line.inputIndex];
    if (
      remaining > 0 &&
      line.component === "PRINT" &&
      targetSize !== "" &&
      normalizePrintSize(source?.size) === targetSize
    ) {
      const take = Math.min(line.quantity, remaining);
      remaining -= take;
      const subtotalCents = line.unitPriceCents * (line.quantity - take);
      discountPrint += line.subtotalCents - subtotalCents;
      creditedKeys.add(keyOf(source));
      next = { ...line, subtotalCents };
    }
    byIndex.set(line, next);
  }

  if (credit.includesDigital) {
    for (const line of ordered) {
      const source = inputItems[line.inputIndex];
      if (
        line.component === "DIGITAL" &&
        source?.includedWithPrint &&
        creditedKeys.has(keyOf(source)) &&
        line.subtotalCents > 0
      ) {
        discountDigital += line.subtotalCents;
        byIndex.set(line, { ...line, unitPriceCents: 0, subtotalCents: 0 });
      }
    }
  }

  const discountArs = discountPrint + discountDigital;
  const creditedPrintUnits = Math.max(0, Math.floor(credit.printUnits)) - remaining;
  if (discountArs === 0) {
    return { totals, creditedPrintUnits, discountArs: 0, discountDigitalArs: 0 };
  }

  const snapshot = totals.snapshot as Record<string, unknown>;
  const percent = Number(snapshot.marketplaceFeePercent ?? 0) || 0;
  const extensionSurchargeCents = Number(snapshot.extensionSurchargeCents ?? 0) || 0;
  const displayTotalCents = Math.max(0, totals.displayTotalCents - discountArs);
  const baseForFee = Math.max(0, displayTotalCents - extensionSurchargeCents);
  const marketplaceFeeCents =
    displayTotalCents > 0 ? feeFromTotal(baseForFee, percent) + extensionSurchargeCents : 0;

  const items = totals.items.map((line) => byIndex.get(line) ?? line);
  const components = totals.components.map((c) => {
    const less = c.component === "PRINT" ? discountPrint : discountDigital;
    const total = Math.max(0, c.displayTotalCents - less);
    return {
      ...c,
      displayTotalCents: total,
      mpTotalCents: total,
      marketplaceFeeCents: total > 0 ? feeFromTotal(total, percent) : 0,
    };
  });

  return {
    totals: {
      displayTotalCents,
      mpTotalCents: displayTotalCents,
      marketplaceFeeCents,
      components,
      items,
      snapshot: {
        ...snapshot,
        items,
        marketplaceFeeCents,
        prepaidPrintCredit: {
          printUnits: credit.printUnits,
          size: credit.size,
          includesDigital: credit.includesDigital,
          creditedPrintUnits,
          discountArs,
        },
      },
    },
    creditedPrintUnits,
    discountArs,
    discountDigitalArs: discountDigital,
  };
}
