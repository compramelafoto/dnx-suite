/**
 * Fixtures sintéticos para caracterización de `calculateCuantoCobro`.
 * Valores técnicos inventados — no representan costos reales de DNX Estudio.
 */
import { DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION } from "../availability.js";
import { createDefaultPersonalExpenseGroups } from "../default-expense-groups.js";
import { INITIAL_EQUIPMENT_INVENTORY } from "../equipment/normalize.js";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "../payment/payment-options-types.js";
import { createEmptyQuoteItem } from "../quote-items.js";
import type {
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
  CuantoCobroQuoteItem,
  MonthlyExpenseGroup,
} from "../types.js";
import type { CommercialPositioningId } from "../commercial-positioning.js";

function withPersonalExpenseAmount(
  groups: MonthlyExpenseGroup[],
  groupId: string,
  itemId: string,
  amount: string,
): MonthlyExpenseGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group;
    return {
      ...group,
      items: group.items.map((item) =>
        item.id === itemId ? { ...item, amount } : item,
      ),
    };
  });
}

/** Perfil técnicamente válido y completo (sintético). */
export function createBaseCompleteProfile(
  overrides: Partial<CuantoCobroProfileInput> = {},
): CuantoCobroProfileInput {
  const personalExpenseGroups = withPersonalExpenseAmount(
    createDefaultPersonalExpenseGroups(),
    "housing",
    "rent-mortgage",
    "200000",
  );

  return {
    currency: "ARS",
    livesOnlyFromPhotography: "yes",
    externalMonthlyIncome: "",
    personalExpenseGroups,
    businessRent: "50000",
    businessSoftware: "15000",
    businessMarketing: "10000",
    employeesCount: "0",
    employeeMonthlyCost: "",
    weeklyHours: "40",
    timeDistribution: { ...DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION },
    daysPerWeek: "",
    externalWorkSituation: "",
    externalWorkWeeklyHours: "",
    equipmentRenewalMonthly: "20000",
    primaryCameraPresetId: "",
    primaryCameraCustomName: "",
    primaryCameraShutterRating: "",
    primaryCameraCurrentShutterCount: "",
    primaryCameraReplacementValue: "",
    estimatedAnnualShots: "",
    equipmentInventory: {
      renewal: { ...INITIAL_EQUIPMENT_INVENTORY.renewal, lenses: [] },
      futureEquipment: [],
    },
    emergencyFundMonthly: "10000",
    savingsGoalsMonthly: "15000",
    commercialPositioningId: "stable",
    ...overrides,
  };
}

export function createOwnServiceConcept(
  overrides: Partial<CuantoCobroQuoteItem> = {},
): CuantoCobroQuoteItem {
  return createEmptyQuoteItem({
    id: "qi-fixture-own-service-1",
    name: "Cobertura sintética de evento",
    description: "Fixture de caracterización — no es un trabajo real",
    quantity: "1",
    itemType: "own-service",
    coverageHours: "6",
    editingHours: "4",
    deliveryHours: "1",
    travelHours: "1",
    directCost: "5000",
    estimatedShots: "",
    desiredMarginPercent: "20",
    ...overrides,
  });
}

/** Cotización completa mínima para status complete. */
export function createBaseCompleteQuote(
  overrides: Partial<CuantoCobroQuoteInput> = {},
): CuantoCobroQuoteInput {
  const { client: clientOverride, concepts: conceptsOverride, ...rest } = overrides;

  const baseClient = {
    name: "Cliente Sintético Characterization",
    company: "",
    email: "",
    phone: "",
    jobDate: "2026-09-20",
    jobLocation: "Ciudad Sintética",
    jobLatitude: "",
    jobLongitude: "",
    jobType: "Evento social sintético",
    hours: {
      salesHours: "1",
      meetingsHours: "0.5",
      generalPrepHours: "1",
      coordinationHours: "0.5",
      billingHours: "0.5",
      followUpHours: "0.5",
      administrativeDeliveryHours: "0.5",
    },
  };

  return {
    client: {
      ...baseClient,
      ...clientOverride,
      hours: {
        ...baseClient.hours,
        ...clientOverride?.hours,
      },
    },
    concepts: conceptsOverride ?? [createOwnServiceConcept()],
    internalNotes: "fixture-characterization",
    commercialDisplayMode: "detailed",
    commercialNote: "",
    chosenPrice: "",
    paymentOptions: {
      ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
      installmentPlans: [],
    },
    status: "draft",
    ...rest,
  };
}

export function withCommercialPositioning(
  profile: CuantoCobroProfileInput,
  id: CommercialPositioningId | "",
): CuantoCobroProfileInput {
  return { ...profile, commercialPositioningId: id };
}

export function withWeeklyHours(
  profile: CuantoCobroProfileInput,
  weeklyHours: string,
): CuantoCobroProfileInput {
  return { ...profile, weeklyHours };
}

export function withZeroBusinessAndReserves(
  profile: CuantoCobroProfileInput,
): CuantoCobroProfileInput {
  return {
    ...profile,
    businessRent: "0",
    businessSoftware: "0",
    businessMarketing: "0",
    equipmentRenewalMonthly: "0",
    emergencyFundMonthly: "0",
    savingsGoalsMonthly: "0",
  };
}

export function withZeroPersonalExpenses(
  profile: CuantoCobroProfileInput,
): CuantoCobroProfileInput {
  return {
    ...profile,
    personalExpenseGroups: createDefaultPersonalExpenseGroups(),
  };
}

export function withHighExternalIncome(
  profile: CuantoCobroProfileInput,
  income = "1000000",
): CuantoCobroProfileInput {
  return {
    ...profile,
    livesOnlyFromPhotography: "no",
    externalMonthlyIncome: income,
  };
}

export function withEmptyEquipment(profile: CuantoCobroProfileInput): CuantoCobroProfileInput {
  return {
    ...profile,
    equipmentRenewalMonthly: "0",
    primaryCameraPresetId: "",
    primaryCameraCustomName: "",
    primaryCameraShutterRating: "",
    primaryCameraCurrentShutterCount: "",
    primaryCameraReplacementValue: "",
    estimatedAnnualShots: "",
    equipmentInventory: {
      renewal: { ...INITIAL_EQUIPMENT_INVENTORY.renewal, lenses: [] },
      futureEquipment: [],
    },
  };
}

export function withConfiguredCamera(
  profile: CuantoCobroProfileInput,
): CuantoCobroProfileInput {
  return {
    ...profile,
    primaryCameraCustomName: "Cámara sintética fixture",
    primaryCameraShutterRating: "150000",
    primaryCameraCurrentShutterCount: "30000",
    primaryCameraReplacementValue: "1200000",
    estimatedAnnualShots: "24000",
  };
}

export function createLongJobQuote(): CuantoCobroQuoteInput {
  return createBaseCompleteQuote({
    client: {
      name: "Cliente Sintético Largo",
      company: "",
      email: "",
      phone: "",
      jobDate: "2026-11-01",
      jobLocation: "Ciudad Sintética",
      jobLatitude: "",
      jobLongitude: "",
      jobType: "Evento largo sintético",
      hours: {
        salesHours: "2",
        meetingsHours: "1",
        generalPrepHours: "2",
        coordinationHours: "1",
        billingHours: "1",
        followUpHours: "1",
        administrativeDeliveryHours: "1",
      },
    },
    concepts: [
      createOwnServiceConcept({
        id: "qi-fixture-long-1",
        name: "Cobertura larga sintética",
        coverageHours: "12",
        editingHours: "8",
        deliveryHours: "2",
        travelHours: "2",
        directCost: "15000",
        desiredMarginPercent: "25",
      }),
    ],
  });
}

export function createMultiConceptQuote(): CuantoCobroQuoteInput {
  return createBaseCompleteQuote({
    concepts: [
      createOwnServiceConcept(),
      createEmptyQuoteItem({
        id: "qi-fixture-outsourced-1",
        name: "Video tercerizado sintético",
        quantity: "1",
        itemType: "outsourced",
        outsourcedLaborCost: "80000",
        managementHours: "2",
        desiredMarginPercent: "15",
      }),
      createEmptyQuoteItem({
        id: "qi-fixture-expense-1",
        name: "Traslado sintético",
        quantity: "1",
        itemType: "expense",
        expenseCost: "12000",
      }),
    ],
  });
}
