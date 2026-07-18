import type {
  PricingProfile,
  PricingServiceTemplate,
  PricingServiceTemplateCatalog,
} from "../models.js";

/**
 * Perfil apto para tests de canal operativo (no sintético).
 * Usa montos de fixture; ID/versión no disparan el guard de producción.
 */
export function createOwnerFacingTestProfile(
  overrides: Partial<PricingProfile> = {},
): PricingProfile {
  return createSyntheticReadyProfile({
    id: "dnx-owner-local-test",
    name: "DNX Owner Local Test",
    profileVersion: "local-dev-1",
    ...overrides,
  });
}

/** Perfil sintético listo — montos inventados solo para tests. */
export function createSyntheticReadyProfile(
  overrides: Partial<PricingProfile> = {},
): PricingProfile {
  return {
    id: "synth-dnx",
    name: "Estudio Sintético Test",
    configured: true,
    profileVersion: "test-1",
    formulaVersion: "clf-orchestrator-characterized",
    currency: "ARS",
    commercialPositioningId: "stable",
    source: "DNX_STUDIO_CONFIG",
    updatedAt: "2026-07-17T00:00:00.000Z",
    income: {
      livesOnlyFromPhotography: "yes",
      externalMonthlyIncome: 0,
    },
    personalExpenses: [
      {
        id: "housing",
        label: "Vivienda sintética",
        monthlyAmount: 100_000,
        enabled: true,
        category: "housing",
      },
    ],
    businessExpenses: [
      {
        id: "software",
        label: "Software sintético",
        monthlyAmount: 10_000,
        enabled: true,
        category: "software",
      },
    ],
    availability: {
      weeklyHours: 40,
      timeDistribution: {
        coverage: 35,
        editing: 30,
        administration: 12,
        sales: 8,
        marketing: 10,
        training: 5,
      },
      billableHoursWeekly: 14,
      vacationWeeksPerYear: 2,
      nonWorkingWeeksPerYear: 0,
    },
    reserves: {
      equipmentRenewalMonthly: 5_000,
      emergencyFundMonthly: 5_000,
      savingsGoalsMonthly: 5_000,
      vacationReserveMonthly: 2_000,
    },
    equipment: [
      {
        id: "cam-1",
        label: "Cámara sintética",
        category: "CAMERA",
        enabled: true,
        replacementValue: 500_000,
        shutterRating: 150_000,
        currentShutterCount: 10_000,
        estimatedAnnualShots: 20_000,
        quantity: 1,
      },
    ],
    ...overrides,
  };
}

export function createSyntheticReadyWeddingTemplate(
  overrides: Partial<PricingServiceTemplate> = {},
): PricingServiceTemplate {
  return {
    id: "tpl-wedding-ready",
    configured: true,
    serviceType: "WEDDING",
    templateVersion: "test-1",
    formulaVersion: "clf-orchestrator-characterized",
    coverage: {
      minimumHours: 4,
      maximumHours: 14,
      defaultHours: 8,
    },
    editing: {
      mode: "HOURS_PER_COVERAGE_HOUR",
      hoursPerCoverageHour: 0.5,
    },
    generalClientHours: {
      sales: 1,
      meetings: 0.5,
      preparation: 1,
      coordination: 0.5,
      billing: 0.5,
      followUp: 0.5,
      deliveryAdministration: 0.5,
    },
    concepts: [
      {
        id: "c-wedding-coverage",
        configured: true,
        type: "OWN_SERVICE",
        label: "Cobertura sintética",
        calculationMode: "PER_COVERAGE_HOUR",
        hoursPerCoverageHour: 1,
        marginPercent: 0,
        quantity: 1,
        includeEquipmentWear: false,
      },
    ],
    requiredQuestions: [],
    ...overrides,
  };
}

export function createSyntheticReadyFifteenthTemplate(): PricingServiceTemplate {
  return {
    ...createSyntheticReadyWeddingTemplate({
      id: "tpl-15-ready",
      serviceType: "FIFTEENTH_BIRTHDAY",
      editing: { mode: "FIXED_HOURS", fixedHours: 3 },
      concepts: [
        {
          id: "c-15-coverage",
          configured: true,
          type: "OWN_SERVICE",
          label: "Cobertura 15 sintética",
          calculationMode: "FIXED",
          hours: 6,
          directCost: 0,
          marginPercent: 0,
          quantity: 1,
        },
      ],
    }),
  };
}

export function createSyntheticReadyProductTemplate(): PricingServiceTemplate {
  return {
    id: "tpl-product-ready",
    configured: true,
    serviceType: "PRODUCT_PHOTOGRAPHY",
    templateVersion: "test-1",
    formulaVersion: "clf-orchestrator-characterized",
    coverage: {
      minimumHours: 1,
      maximumHours: 8,
      defaultHours: 2,
    },
    editing: {
      mode: "FIXED_HOURS",
      fixedHours: 1,
    },
    generalClientHours: {
      sales: 0.5,
      meetings: 0,
      preparation: 0.5,
      coordination: 0,
      billing: 0.25,
      followUp: 0.25,
      deliveryAdministration: 0.25,
    },
    concepts: [
      {
        id: "c-product-session",
        configured: true,
        type: "OWN_SERVICE",
        label: "Sesión de producto sintética",
        calculationMode: "FIXED",
        hours: 2,
        directCost: 1000,
        marginPercent: 10,
        quantity: 1,
      },
      {
        id: "c-product-prints",
        configured: true,
        type: "PRODUCT",
        label: "Impresiones sintéticas",
        calculationMode: "FIXED",
        directCost: 5000,
        marginPercent: 25,
        quantity: 1,
      },
    ],
    requiredQuestions: [],
  };
}

export function createSyntheticReadySportsTemplate(): PricingServiceTemplate {
  return {
    ...createSyntheticReadyWeddingTemplate({
      id: "tpl-sports-ready",
      serviceType: "SPORTS_EVENT",
      coverage: {
        minimumHours: 2,
        maximumHours: 10,
        defaultHours: 4,
      },
      editing: { mode: "FIXED_HOURS", fixedHours: 2 },
      concepts: [
        {
          id: "c-sports-coverage",
          configured: true,
          type: "OWN_SERVICE",
          label: "Cobertura deportiva sintética",
          calculationMode: "FIXED",
          hours: 4,
          directCost: 0,
          marginPercent: 0,
          quantity: 1,
        },
      ],
    }),
  };
}

export function createSyntheticReadyFamilyTemplate(): PricingServiceTemplate {
  return {
    ...createSyntheticReadyWeddingTemplate({
      id: "tpl-family-ready",
      serviceType: "FAMILY_SESSION",
      coverage: {
        minimumHours: 1,
        maximumHours: 4,
        defaultHours: 2,
      },
      editing: { mode: "FIXED_HOURS", fixedHours: 1 },
      concepts: [
        {
          id: "c-family-session",
          configured: true,
          type: "OWN_SERVICE",
          label: "Sesión familiar sintética",
          calculationMode: "FIXED",
          hours: 2,
          directCost: 0,
          marginPercent: 0,
          quantity: 1,
        },
      ],
    }),
  };
}

export function createSyntheticReadyCatalog(): PricingServiceTemplateCatalog {
  return {
    configured: true,
    catalogVersion: "test-1",
    formulaVersion: "clf-orchestrator-characterized",
    templates: [
      createSyntheticReadyWeddingTemplate(),
      createSyntheticReadyFifteenthTemplate(),
      createSyntheticReadyProductTemplate(),
      createSyntheticReadySportsTemplate(),
      createSyntheticReadyFamilyTemplate(),
    ],
  };
}
