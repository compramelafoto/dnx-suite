import type { PhotographyServiceType } from "../quote-request/models.js";

/**
 * Contratos de precios del asistente (Etapas 08–09).
 * Desacoplados de ComprameLaFoto. Sin cálculo de precios en esta etapa.
 */

export type PricingProfileVersion = string;
export type PricingTemplateVersion = string;
export type PricingFormulaVersion = string;
export type PricingCatalogVersion = string;

export type PricingCommercialPositioningId =
  | "starting"
  | "growing"
  | "stable"
  | "established"
  | "high-demand";

export type PricingConfigurationIssueSeverity = "ERROR" | "WARNING";

export type PricingConfigurationIssue = {
  code: string;
  path: string;
  severity: PricingConfigurationIssueSeverity;
  message: string;
};

export type PricingExpenseLine = {
  id: string;
  label: string;
  monthlyAmount: number;
  enabled: boolean;
  category?: string;
};

export type PricingTimeDistributionPercent = {
  coverage: number;
  editing: number;
  administration: number;
  sales: number;
  marketing: number;
  training: number;
};

export type PricingAvailability = {
  weeklyHours: number;
  /** Porcentajes 0–100; deben sumar ~100 cuando el perfil está listo. */
  timeDistribution: PricingTimeDistributionPercent;
  /**
   * Horas semanales facturables (cobertura).
   * Si se omite, se deriva de weeklyHours × coverage%.
   */
  billableHoursWeekly?: number;
  vacationWeeksPerYear?: number;
  nonWorkingWeeksPerYear?: number;
};

export type PricingReserves = {
  equipmentRenewalMonthly: number;
  emergencyFundMonthly: number;
  savingsGoalsMonthly: number;
  vacationReserveMonthly: number;
};

export type PricingEquipmentCategory =
  | "CAMERA"
  | "LENS"
  | "FLASH"
  | "COMPUTER"
  | "DISK"
  | "MEMORY"
  | "OTHER";

export type PricingEquipmentItem = {
  id: string;
  label: string;
  category: PricingEquipmentCategory;
  enabled: boolean;
  replacementValue?: number;
  usefulLifeYears?: number;
  ageYears?: number;
  shutterRating?: number;
  currentShutterCount?: number;
  estimatedAnnualShots?: number;
  quantity?: number;
};

export type PricingProfile = {
  id: string;
  name: string;
  configured: boolean;
  profileVersion: PricingProfileVersion;
  formulaVersion: PricingFormulaVersion;
  currency: string;
  commercialPositioningId: PricingCommercialPositioningId | "";
  source: "DNX_STUDIO_CONFIG";
  updatedAt: string;
  notes?: string;
  income: {
    livesOnlyFromPhotography: "yes" | "no";
    externalMonthlyIncome: number;
  };
  personalExpenses: PricingExpenseLine[];
  businessExpenses: PricingExpenseLine[];
  availability: PricingAvailability;
  reserves: PricingReserves;
  equipment: PricingEquipmentItem[];
};

export type PricingProfileReadiness = {
  ready: boolean;
  configured: boolean;
  errors: PricingConfigurationIssue[];
  warnings: PricingConfigurationIssue[];
  missingFields: string[];
};

export type PricingEditingMode =
  | "FIXED_HOURS"
  | "HOURS_PER_COVERAGE_HOUR"
  | "MANUAL";

export type PricingConceptType =
  | "OWN_SERVICE"
  | "PRODUCT"
  | "OUTSOURCED"
  | "EXPENSE";

export type PricingConceptCalculationMode =
  | "FIXED"
  | "PER_COVERAGE_HOUR"
  | "PER_UNIT"
  | "MANUAL";

export type PricingConceptTemplate = {
  id: string;
  configured: boolean;
  type: PricingConceptType;
  label: string;
  calculationMode: PricingConceptCalculationMode;
  hours?: number;
  hoursPerCoverageHour?: number;
  directCost?: number;
  marginPercent?: number;
  quantity?: number;
  includeEquipmentWear?: boolean;
};

export type PricingServiceTemplate = {
  id: string;
  configured: boolean;
  serviceType: PhotographyServiceType;
  templateVersion: PricingTemplateVersion;
  formulaVersion: PricingFormulaVersion;
  coverage: {
    minimumHours: number;
    maximumHours: number;
    defaultHours?: number;
  };
  editing: {
    mode: PricingEditingMode;
    fixedHours?: number;
    hoursPerCoverageHour?: number;
  };
  generalClientHours: {
    sales: number;
    meetings: number;
    preparation: number;
    coordination: number;
    billing: number;
    followUp: number;
    deliveryAdministration: number;
  };
  concepts: PricingConceptTemplate[];
  requiredQuestions: string[];
  notes?: string;
};

export type PricingServiceTemplateCatalog = {
  configured: boolean;
  catalogVersion: PricingCatalogVersion;
  formulaVersion: PricingFormulaVersion;
  templates: PricingServiceTemplate[];
};

export type PricingServiceTemplateReadiness = {
  ready: boolean;
  configured: boolean;
  errors: PricingConfigurationIssue[];
  warnings: PricingConfigurationIssue[];
  missingFields: string[];
};

export type PricingTemplateCatalogReadiness = PricingServiceTemplateReadiness;

export type PricingConfigurationLoadResult<T> =
  | {
      status: "READY";
      value: T;
      warnings: PricingConfigurationIssue[];
    }
  | {
      status: "NOT_CONFIGURED";
      issues: PricingConfigurationIssue[];
    }
  | {
      status: "INVALID";
      issues: PricingConfigurationIssue[];
    }
  | {
      status: "NOT_FOUND";
      issues: PricingConfigurationIssue[];
    };

/** Datos variables del trabajo (conversación + derivaciones de plantilla). */
export type PricingJobInput = {
  serviceType: PhotographyServiceType;
  /** Metadata — no afecta precio todavía. */
  eventDate?: string;
  /** Metadata — no afecta precio todavía. */
  city?: string;
  durationHours: number;
  coverageHours: number;
  editingHours?: number;
  editingResolution:
    | "FIXED_HOURS"
    | "HOURS_PER_COVERAGE_HOUR"
    | "PENDING_MANUAL"
    | "NONE";
  generalClientHours: PricingServiceTemplate["generalClientHours"];
  plannedConcepts: PreparedPricingConcept[];
};

/** Concepto ya resuelto por preparePricingJob (sin precios). */
export type PreparedPricingConcept = {
  id: string;
  label: string;
  type: PricingConceptType;
  calculationMode: PricingConceptCalculationMode;
  quantity: number;
  /** Horas propias resueltas (cobertura u otras según tipo). */
  hours?: number;
  hoursPerCoverageHour?: number;
  directCost?: number;
  marginPercent?: number;
  includeEquipmentWear?: boolean;
};

/** Re-exportados desde calculation-contract (Etapa 12). */
export type {
  PricingApprovalStatus,
  PricingCalculationRequest,
  PricingCalculationResult,
  PricingCalculationStatus,
  PricingInternalBreakdown,
} from "./calculation-contract.js";

export type PreparedPricingJobResult =
  | {
      status: "READY";
      job: PricingJobInput;
      templateVersion: string;
      warnings: string[];
    }
  | {
      status: "INCOMPLETE";
      missingFields: string[];
      warnings: string[];
    }
  | {
      status: "UNSUPPORTED";
      reason: string;
      warnings: string[];
    };

export type PricingConfigurationSafeSummary = {
  profileFound: boolean;
  profileConfigured: boolean;
  profileReady: boolean;
  profileVersion?: string;
  formulaVersion?: string;
  currencyPresent: boolean;
  commercialPositioningPresent: boolean;
  enabledPersonalExpenseCount: number;
  enabledBusinessExpenseCount: number;
  equipmentItemCount: number;
  catalogFound: boolean;
  catalogConfigured: boolean;
  catalogReady: boolean;
  configuredTemplateCount: number;
  unconfiguredTemplateCount: number;
  availableServiceTypes: PhotographyServiceType[];
  errors: PricingConfigurationIssue[];
  warnings: PricingConfigurationIssue[];
};

/** Tipos de servicio con plantilla cotizable (excluye UNKNOWN). */
export const PRICABLE_SERVICE_TYPES = [
  "WEDDING",
  "FIFTEENTH_BIRTHDAY",
  "BIRTHDAY",
  "CORPORATE_EVENT",
  "SOCIAL_EVENT",
  "PORTRAIT_SESSION",
  "FAMILY_SESSION",
  "PRODUCT_PHOTOGRAPHY",
  "SCHOOL_PHOTOGRAPHY",
  "SPORTS_EVENT",
  "OTHER",
] as const satisfies readonly PhotographyServiceType[];

export type PricableServiceType = (typeof PRICABLE_SERVICE_TYPES)[number];
