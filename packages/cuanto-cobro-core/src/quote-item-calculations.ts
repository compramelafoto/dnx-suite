import { parseCuantoCobroAmount } from "./amount-format";
import type { CameraWearPolicy } from "./camera-wear-policy";
import { calculateConceptCameraWear } from "./camera-wear-policy";
import type { QuoteLaborRates } from "./hourly-rates";
import { getOwnServicePostProductionHours } from "./quote-item-hours";
import {
  computeQuoteItemPriceFromBaseCost,
  parseQuoteItemHours,
  parseQuoteItemQuantity,
} from "./quote-items";
import type { CuantoCobroAssignmentActivity, CuantoCobroQuoteItem, CuantoCobroQuoteItemType } from "./types";

/** Mi estudio: lo que costaron las horas de cada persona en un concepto. */
export type QuoteItemPersonLabor = {
  personId: string;
  activity: CuantoCobroAssignmentActivity;
  /** Horas-persona (ya multiplicadas por la cantidad). */
  hours: number;
  cost: number;
  /** La persona no tiene tarifa (borrada, inactiva o por trabajo): se cobró al valor hora del estudio. */
  atStudioRate: boolean;
};

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
  /** Mi estudio: sólo si el concepto trae asignaciones y el perfil está en modo estudio. */
  laborByPerson?: QuoteItemPersonLabor[];
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
  /** Mi estudio: horas y costo de cada persona en el trabajo (sumado entre conceptos). Sólo si hay asignaciones. */
  laborByPerson?: Array<{ personId: string; hours: number; cost: number; atStudioRate: boolean }>;
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
  const byPerson: QuoteItemPersonLabor[] = [];

  switch (item.itemType) {
    case "own-service": {
      accumulateActivity(labor, item, "coverage", parseQuoteItemHours(item.coverageHours), rates.coverage, rates, quantity, byPerson);
      accumulateActivity(labor, item, "editing", getOwnServicePostProductionHours(item), rates.editing, rates, quantity, byPerson);
      accumulateActivity(labor, item, "delivery", parseQuoteItemHours(item.deliveryHours), rates.delivery, rates, quantity, byPerson);
      accumulateActivity(labor, item, "travel", parseQuoteItemHours(item.travelHours), rates.travel, rates, quantity, byPerson);
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
      // Diseño, revisión y correcciones: una sola actividad ("production") para asignar.
      accumulateActivity(
        labor,
        item,
        "production",
        parseQuoteItemHours(item.productionHours) + parseQuoteItemHours(item.reviewHours) + parseQuoteItemHours(item.correctionHours),
        rates.editing,
        rates,
        quantity,
        byPerson,
      );
      const unitSupplier = parseCuantoCobroAmount(item.supplierCost) ?? 0;
      const unitPackaging = parseCuantoCobroAmount(item.packagingCost) ?? 0;
      const unitShipping = parseCuantoCobroAmount(item.shippingCost) ?? 0;
      directCost = (unitSupplier + unitPackaging + unitShipping) * quantity;

      // Carnet y similares: disparos en una cámara elegida (sólo si el producto la eligió).
      if (cameraWearPolicy && item.cameraId) {
        const wear = calculateConceptCameraWear(item, cameraWearPolicy);
        estimatedShots = wear.estimatedShots;
        cameraWearInformative = wear.cameraWearInformative;
        cameraWearCharged = wear.cameraWearCharged;
        directCost += cameraWearCharged;
      }
      break;
    }
    case "outsourced": {
      accumulateActivity(labor, item, "management", parseQuoteItemHours(item.managementHours), rates.administration, rates, quantity, byPerson);
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
    ...(byPerson.length > 0 ? { laborByPerson: byPerson } : {}),
  };
}

/**
 * Horas de una actividad: las asignadas a una persona van a su tarifa; lo que falta asignar, a la tarifa
 * general (el valor hora del estudio). Si lo asignado supera las horas del concepto, mandan las
 * asignaciones (son horas-persona). Sin tarifas por persona, lo de siempre.
 */
function accumulateActivity(
  target: { laborCost: number; ownHours: number },
  item: CuantoCobroQuoteItem,
  activity: CuantoCobroAssignmentActivity,
  itemHours: number,
  rate: number,
  rates: QuoteLaborRates,
  quantity: number,
  byPerson: QuoteItemPersonLabor[],
): void {
  const assigned = rates.byPerson && Array.isArray(item.assignments)
    ? item.assignments.filter((a) => a && a.activity === activity && parseQuoteItemHours(a.hours) > 0)
    : [];
  if (assigned.length === 0) {
    accumulateLabor(target, itemHours, rate, quantity);
    return;
  }
  let assignedHours = 0;
  for (const a of assigned) {
    const hours = parseQuoteItemHours(a.hours);
    const personRate = rates.byPerson?.[a.personId];
    const effective = personRate ?? rate;
    assignedHours += hours;
    target.laborCost += hours * effective * quantity;
    target.ownHours += hours * quantity;
    byPerson.push({ personId: a.personId, activity, hours: hours * quantity, cost: hours * effective * quantity, atStudioRate: personRate === undefined });
  }
  accumulateLabor(target, Math.max(0, itemHours - assignedHours), rate, quantity);
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
  const porPersona = new Map<string, { personId: string; hours: number; cost: number; atStudioRate: boolean }>();
  for (const row of calculated) {
    for (const l of row.laborByPerson ?? []) {
      const acc = porPersona.get(l.personId) ?? { personId: l.personId, hours: 0, cost: 0, atStudioRate: l.atStudioRate };
      acc.hours += l.hours;
      acc.cost += l.cost;
      porPersona.set(l.personId, acc);
    }
  }

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
    ...(porPersona.size > 0 ? { laborByPerson: [...porPersona.values()] } : {}),
  };
}

export { sumConceptOwnServiceHours as sumOwnServiceHours } from "./normalize-quote-hours";
