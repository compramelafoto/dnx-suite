import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import { CONCEPT_TYPE_LABELS } from "@/lib/cuantocobro/quote-access";
import { parseQuoteItemHours, parseQuoteItemQuantity } from "@/lib/cuantocobro/quote-items";
import { sumOwnServiceHoursIncludingLegacy } from "@/lib/cuantocobro/quote-item-hours";
import type { CuantoCobroQuoteItem } from "@/lib/cuantocobro/types";
import type { CuantoCobroQuoteItemCalculated } from "@/lib/cuantocobro/quote-item-calculations";

export function getConceptListMeta(item: CuantoCobroQuoteItem, calculated?: CuantoCobroQuoteItemCalculated): string {
  const parts: string[] = [CONCEPT_TYPE_LABELS[item.itemType]];
  const quantity = parseQuoteItemQuantity(item.quantity);
  if (quantity > 1) parts.push(`Cantidad ${quantity}`);

  if (item.itemType === "own-service") {
    const hours = sumOwnServiceHoursIncludingLegacy(item);
    if (hours > 0) parts.push(`${hours} h propias`);
  } else if (item.itemType === "physical-product") {
    const hours =
      parseQuoteItemHours(item.productionHours) +
      parseQuoteItemHours(item.reviewHours) +
      parseQuoteItemHours(item.correctionHours);
    if (hours > 0) parts.push(`${hours} h diseño`);
  } else if (item.itemType === "outsourced") {
    const hours = parseQuoteItemHours(item.managementHours);
    if (hours > 0) parts.push(`${hours} h gestión`);
  }

  if (calculated) {
    if (calculated.ownHours > 0) parts.push(`${calculated.ownHours} h valoradas`);
    const margin = calculated.marginPercent;
    if (margin > 0) {
      parts.push(
        item.itemType === "physical-product" ? `Ganancia ${margin}%` : `Margen ${margin}%`,
      );
    }
  }

  return parts.join(" · ");
}

export function isConceptSetupIncomplete(item: CuantoCobroQuoteItem): boolean {
  if (!item.name.trim()) return true;
  if (!parseQuoteItemQuantity(item.quantity)) return true;

  switch (item.itemType) {
    case "own-service":
      return sumOwnServiceHoursIncludingLegacy(item) <= 0 && (parseCuantoCobroAmount(item.directCost) ?? 0) <= 0;
    case "physical-product":
      return (
        (parseCuantoCobroAmount(item.supplierCost) ?? 0) <= 0 &&
        (parseCuantoCobroAmount(item.packagingCost) ?? 0) <= 0 &&
        (parseCuantoCobroAmount(item.shippingCost) ?? 0) <= 0 &&
        parseQuoteItemHours(item.productionHours) <= 0 &&
        parseQuoteItemHours(item.reviewHours) <= 0 &&
        parseQuoteItemHours(item.correctionHours) <= 0
      );
    case "outsourced":
      return (parseCuantoCobroAmount(item.outsourcedLaborCost) ?? 0) <= 0;
    case "expense":
      return (parseCuantoCobroAmount(item.expenseCost) ?? 0) <= 0;
    default:
      return false;
  }
}

/** @deprecated Usar isConceptSetupIncomplete */
export const isQuoteItemSetupIncomplete = isConceptSetupIncomplete;

/** @deprecated Usar getConceptListMeta */
export const getQuoteItemListMeta = getConceptListMeta;
