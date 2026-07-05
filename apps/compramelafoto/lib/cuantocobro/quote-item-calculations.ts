import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import type { CameraWearPolicy } from "@/lib/cuantocobro/camera-wear-policy";
import { calculateConceptCameraWear } from "@/lib/cuantocobro/camera-wear-policy";
import type { QuoteLaborRates } from "@/lib/cuantocobro/hourly-rates";
import { getOwnServicePostProductionHours } from "@/lib/cuantocobro/quote-item-hours";
import {
  computeQuoteItemPriceFromBaseCost,
  parseQuoteItemHours,
  parseQuoteItemQuantity,
} from "@/lib/cuantocobro/quote-items";
import type { CuantoCobroQuoteItem, CuantoCobroQuoteItemType } from "@/lib/cuantocobro/types";

export type CuantoCobroQuoteItemCalculated = {
  item: CuantoCobroQuoteItem;
  quantity: number;
  baseCost: number;
  laborCost: number;
  directCost: number;
  cameraWearInformative: number;
  cameraWearCharged: number;
  estimatedShots: number;
  ownHours: number;
  marginPercent: number;
  marginAmount: number;
  suggestedPrice: number;
};

export type CuantoCobroQuoteSummary = {
  items: CuantoCobroQuoteItemCalculated[];
  subtotalOwnService: number;
  subtotalPhysicalProduct: number;
  subtotalOutsourced: number;
  subtotalExpense: number;
  totalBaseCost: number;
  totalLaborCost: number;
  totalDirectCost: number;
  totalCameraWearInformative: number;
  totalCameraWearCharged: number;
  totalOwnHours: number;
  totalMarginAmount: number;
  totalSuggestedPrice: number;
};

function laborForHours(hours: number, rate: number, quantity: number): { laborCost: number; ownHours: number } {
  const totalHours = hours * quantity;
  return {
    ownHours: totalHours,
    laborCost: hours * rate * quantity,
  };
}

function accumulateLabor(
  target: { laborCost: number; ownHours: number },
  hours: number,
  rate: number,
  quantity: number,
): void {
  const next = laborForHours(hours, rate, quantity);
  target.laborCost += next.laborCost;
  target.ownHours += next.ownHours;
}

export function calculateQuoteItem(
  item: CuantoCobroQuoteItem,
  rates: QuoteLaborRates,
  cameraWearPolicy?: CameraWearPolicy,
): CuantoCobroQuoteItemCalculated {
  const quantity = parseQuoteItemQuantity(item.quantity);

  let laborCost = 0;
  let directCost = 0;
  let ownHours = 0;
  let cameraWearInformative = 0;
  let cameraWearCharged = 0;
  let estimatedShots = 0;
  const labor = { laborCost, ownHours };

  switch (item.itemType) {
    case "own-service": {
      accumulateLabor(labor, parseQuoteItemHours(item.coverageHours), rates.coverage, quantity);
      accumulateLabor(labor, getOwnServicePostProductionHours(item), rates.editing, quantity);
      accumulateLabor(labor, parseQuoteItemHours(item.deliveryHours), rates.delivery, quantity);
      accumulateLabor(labor, parseQuoteItemHours(item.travelHours), rates.travel, quantity);
      const unitDirect = parseCuantoCobroAmount(item.directCost) ?? 0;
      directCost = unitDirect * quantity;

      if (cameraWearPolicy) {
        const wear = calculateConceptCameraWear(item, cameraWearPolicy);
        estimatedShots = wear.estimatedShots;
        cameraWearInformative = wear.cameraWearInformative;
        cameraWearCharged = wear.cameraWearCharged;
        directCost += cameraWearCharged;
      }
      break;
    }
    case "physical-product": {
      accumulateLabor(labor, parseQuoteItemHours(item.productionHours), rates.editing, quantity);
      accumulateLabor(labor, parseQuoteItemHours(item.reviewHours), rates.editing, quantity);
      accumulateLabor(labor, parseQuoteItemHours(item.correctionHours), rates.editing, quantity);
      const unitSupplier = parseCuantoCobroAmount(item.supplierCost) ?? 0;
      const unitPackaging = parseCuantoCobroAmount(item.packagingCost) ?? 0;
      const unitShipping = parseCuantoCobroAmount(item.shippingCost) ?? 0;
      directCost = (unitSupplier + unitPackaging + unitShipping) * quantity;
      break;
    }
    case "outsourced": {
      accumulateLabor(labor, parseQuoteItemHours(item.managementHours), rates.administration, quantity);
      const unitOutsourced = parseCuantoCobroAmount(item.outsourcedLaborCost) ?? 0;
      directCost = unitOutsourced * quantity;
      break;
    }
    case "expense": {
      const unitExpense = parseCuantoCobroAmount(item.expenseCost) ?? 0;
      directCost = unitExpense * quantity;
      break;
    }
  }

  laborCost = labor.laborCost;
  ownHours = labor.ownHours;

  const baseCost = laborCost + directCost;
  const { marginPercent, marginAmount, suggestedPrice } = computeQuoteItemPriceFromBaseCost(baseCost, item);

  return {
    item,
    quantity,
    baseCost,
    laborCost,
    directCost,
    cameraWearInformative,
    cameraWearCharged,
    estimatedShots,
    ownHours,
    marginPercent,
    marginAmount,
    suggestedPrice,
  };
}

function subtotalForType(items: CuantoCobroQuoteItemCalculated[], type: CuantoCobroQuoteItemType): number {
  return items
    .filter((row) => row.item.itemType === type)
    .reduce((sum, row) => sum + row.suggestedPrice, 0);
}

export function calculateQuoteSummary(
  items: CuantoCobroQuoteItem[],
  rates: QuoteLaborRates,
  cameraWearPolicy?: CameraWearPolicy,
): CuantoCobroQuoteSummary {
  const calculated = items.map((item) => calculateQuoteItem(item, rates, cameraWearPolicy));

  return {
    items: calculated,
    subtotalOwnService: subtotalForType(calculated, "own-service"),
    subtotalPhysicalProduct: subtotalForType(calculated, "physical-product"),
    subtotalOutsourced: subtotalForType(calculated, "outsourced"),
    subtotalExpense: subtotalForType(calculated, "expense"),
    totalBaseCost: calculated.reduce((sum, row) => sum + row.baseCost, 0),
    totalLaborCost: calculated.reduce((sum, row) => sum + row.laborCost, 0),
    totalDirectCost: calculated.reduce((sum, row) => sum + row.directCost, 0),
    totalCameraWearInformative: calculated.reduce((sum, row) => sum + row.cameraWearInformative, 0),
    totalCameraWearCharged: calculated.reduce((sum, row) => sum + row.cameraWearCharged, 0),
    totalOwnHours: calculated.reduce((sum, row) => sum + row.ownHours, 0),
    totalMarginAmount: calculated.reduce((sum, row) => sum + row.marginAmount, 0),
    totalSuggestedPrice: calculated.reduce((sum, row) => sum + row.suggestedPrice, 0),
  };
}

export { sumConceptOwnServiceHours as sumOwnServiceHours } from "@/lib/cuantocobro/normalize-quote-hours";
