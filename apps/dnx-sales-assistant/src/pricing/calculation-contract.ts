import type { CuantoCobroCompatibleCalculationInput } from "./cuanto-cobro-adapter/compatible-models.js";

/** Misma forma que PricingConfigurationIssue — evita ciclo models ↔ contract. */
export type PricingCalculationIssue = {
  code: string;
  path: string;
  severity: "ERROR" | "WARNING";
  message: string;
};

/**
 * Cálculo técnico válido ≠ precio comercial aprobado ≠ precio enviado al cliente.
 * Sin persistencia ni workflow en esta etapa.
 */
export type PricingApprovalStatus = "NOT_REVIEWED" | "APPROVED" | "REJECTED";

export type PricingCalculationStatus = "READY" | "INCOMPLETE" | "FAILED";

/**
 * Breakdown interno del motor — no exponer en HTTP ni logs públicos.
 * `recommendedPriceLegacy` es el campo histórico del core; NO es el precio comercial DNX.
 */
export type PricingInternalBreakdown = {
  monthlyNeed: number;
  hourlyRate: number;
  humanCost: number;
  variableCosts: number;
  equipmentSavingsMonthly: number;
  totalCameraWearCharged: number;
  totalCameraWearInformative: number;
  minimumSustainablePrice: number;
  recommendedBusinessPrice: number;
  recommendedPriceLegacy: number;
  coreWarnings: string[];
};

/**
 * Request del engine: input ya adaptado (capa C).
 * No carga config ni conoce HTTP.
 */
export type PricingCalculationRequest = {
  input: CuantoCobroCompatibleCalculationInput;
  profileVersion: string;
  templateVersion: string;
  formulaVersion: string;
  warnings?: PricingCalculationIssue[];
};

/**
 * Precio comercial DNX = `recommendedBusinessPrice` (no `recommendedPrice` del core).
 */
export type PricingCalculationResult =
  | {
      status: "READY";
      minimumSustainablePrice: number;
      recommendedBusinessPrice: number;
      currency: string;
      warnings: PricingCalculationIssue[];
      profileVersion: string;
      templateVersion: string;
      formulaVersion: string;
      approvalStatus: PricingApprovalStatus;
      breakdown: PricingInternalBreakdown;
    }
  | {
      status: "INCOMPLETE";
      missingFields: string[];
      issues: PricingCalculationIssue[];
      approvalStatus: PricingApprovalStatus;
      profileVersion?: string;
      templateVersion?: string;
      formulaVersion?: string;
    }
  | {
      status: "FAILED";
      issues: PricingCalculationIssue[];
      approvalStatus: PricingApprovalStatus;
      profileVersion?: string;
      templateVersion?: string;
      formulaVersion?: string;
    };
