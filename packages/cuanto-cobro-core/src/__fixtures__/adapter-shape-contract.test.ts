/**
 * Contrato de forma (espejo) — verifica que un JSON sintético compatible
 * con el adaptador del asistente satisface calculateCuantoCobro → complete.
 *
 * No importa apps/dnx-sales-assistant (evita import cruzado).
 * El JSON replica la forma del DTO del adaptador.
 */
import { describe, expect, it } from "vitest";
import { calculateCuantoCobro } from "../calculate-cuanto-cobro.js";
import type {
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
} from "../types.js";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "../payment/payment-options-types.js";

/** Fixture espejo del output READY del adaptador (sintético). */
const mirrorProfile = {
  currency: "ARS",
  livesOnlyFromPhotography: "yes",
  externalMonthlyIncome: "0",
  personalExpenseGroups: [
    {
      id: "housing",
      title: "Vivienda sintética",
      items: [
        {
          id: "housing-amount",
          label: "Vivienda sintética",
          amount: "200000",
          isCustom: true,
        },
      ],
    },
  ],
  businessRent: "50000",
  businessSoftware: "15000",
  businessMarketing: "10000",
  employeesCount: "0",
  employeeMonthlyCost: "",
  weeklyHours: "40",
  timeDistribution: {
    coverage: "35",
    editing: "30",
    administration: "12",
    sales: "8",
    marketing: "10",
    training: "5",
  },
  daysPerWeek: "",
  externalWorkSituation: "",
  externalWorkWeeklyHours: "",
  equipmentRenewalMonthly: "20000",
  primaryCameraPresetId: "",
  primaryCameraCustomName: "Cámara sintética",
  primaryCameraShutterRating: "150000",
  primaryCameraCurrentShutterCount: "10000",
  primaryCameraReplacementValue: "500000",
  estimatedAnnualShots: "20000",
  equipmentInventory: {
    renewal: {
      camera: {
        presetId: "",
        customName: "Cámara sintética",
        shutterRating: "150000",
        currentShutterCount: "10000",
        replacementValue: "500000",
        resaleValue: "",
        estimatedAnnualShots: "20000",
      },
      lenses: [],
      memoryCards: null,
      computer: null,
      monitor: null,
      storageDisks: null,
      speedlight: null,
      studioFlash: null,
      aaBatteries: null,
    },
    futureEquipment: [],
  },
  emergencyFundMonthly: "10000",
  savingsGoalsMonthly: "15000",
  commercialPositioningId: "stable",
} satisfies CuantoCobroProfileInput;

const mirrorQuote = {
  client: {
    name: "Cliente por confirmar",
    company: "",
    email: "",
    phone: "",
    jobDate: "2026-09-20",
    jobLocation: "Ciudad Sintética",
    jobLatitude: "",
    jobLongitude: "",
    jobType: "boda",
    hours: {
      salesHours: "1",
      meetingsHours: "0.5",
      generalPrepHours: "1",
      coordinationHours: "0.5",
      billingHours: "0.5",
      followUpHours: "0.5",
      administrativeDeliveryHours: "0.5",
    },
  },
  concepts: [
    {
      id: "c-wedding-coverage",
      name: "Cobertura sintética",
      description: "",
      quantity: "1",
      itemType: "own-service",
      coverageHours: "8",
      editingHours: "4",
      selectionHours: "",
      deliveryHours: "",
      travelHours: "",
      administrationHours: "",
      salesHours: "",
      directCost: "0",
      estimatedShots: "",
      supplierCost: "",
      productionHours: "",
      reviewHours: "",
      correctionHours: "",
      packagingCost: "",
      shippingCost: "",
      outsourcedLaborCost: "",
      managementHours: "",
      expenseCost: "",
      desiredMarginPercent: "0",
    },
  ],
  internalNotes: "adapter-shape-contract",
  commercialDisplayMode: "detailed",
  commercialNote: "",
  chosenPrice: "",
  paymentOptions: {
    ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
    installmentPlans: [],
  },
  status: "draft",
} satisfies CuantoCobroQuoteInput;

describe("adapter shape contract (mirror)", () => {
  it("JSON espejo del adaptador produce status complete en el motor real", () => {
    const result = calculateCuantoCobro(mirrorProfile, mirrorQuote);
    expect(result.status).toBe("complete");
    if (result.status !== "complete") return;
    expect(result.currency).toBe("ARS");
    expect(result.minimumSustainablePrice).toBeGreaterThan(0);
    expect(result.recommendedBusinessPrice).toBeGreaterThanOrEqual(
      result.minimumSustainablePrice,
    );
  });
});
