/**
 * Mapea el resultado de @repo/cuanto-cobro-core → PricingCalculationResult.
 *
 * Decisión DNX: el precio comercial válido es `recommendedBusinessPrice`.
 * `recommendedPrice` del core es legado (tarifa de trabajo); no se usa como recomendado comercial.
 */
import type { CuantoCobroCalculationResult } from "@repo/cuanto-cobro-core";
import type {
  PricingCalculationIssue,
  PricingCalculationResult,
  PricingInternalBreakdown,
} from "../calculation-contract.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";

export type MapCoreResultVersions = {
  profileVersion: string;
  templateVersion: string;
  formulaVersion: string;
  priorWarnings?: PricingCalculationIssue[];
};

function isFiniteNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

function coreWarningsToIssues(warnings: string[]): PricingCalculationIssue[] {
  return warnings.map((message, index) =>
    issue("CORE_WARNING", `core.warnings[${index}]`, "WARNING", message),
  );
}

function validateCompleteInvariants(
  core: Extract<CuantoCobroCalculationResult, { status: "complete" }>,
  versions: MapCoreResultVersions,
): PricingCalculationIssue[] {
  const issues: PricingCalculationIssue[] = [];

  if (!versions.profileVersion?.trim()) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_VERSION_MISSING,
        "profileVersion",
        "ERROR",
        "Falta profileVersion en el resultado del engine.",
      ),
    );
  }
  if (!versions.templateVersion?.trim()) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_VERSION_MISSING,
        "templateVersion",
        "ERROR",
        "Falta templateVersion en el resultado del engine.",
      ),
    );
  }
  if (!versions.formulaVersion?.trim()) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_VERSION_MISSING,
        "formulaVersion",
        "ERROR",
        "Falta formulaVersion en el resultado del engine.",
      ),
    );
  }

  if (!core.currency?.trim()) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_CURRENCY_MISSING,
        "currency",
        "ERROR",
        "El resultado del core no incluye moneda.",
      ),
    );
  }

  if (!isFiniteNonNegative(core.minimumSustainablePrice)) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_INVALID_MINIMUM_PRICE,
        "minimumSustainablePrice",
        "ERROR",
        "minimumSustainablePrice inválido (debe ser finito y ≥ 0).",
      ),
    );
  }

  if (!isFiniteNonNegative(core.recommendedBusinessPrice)) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_INVALID_RECOMMENDED_PRICE,
        "recommendedBusinessPrice",
        "ERROR",
        "recommendedBusinessPrice inválido (debe ser finito y ≥ 0).",
      ),
    );
  }

  if (
    isFiniteNonNegative(core.minimumSustainablePrice) &&
    isFiniteNonNegative(core.recommendedBusinessPrice) &&
    core.recommendedBusinessPrice < core.minimumSustainablePrice
  ) {
    issues.push(
      issue(
        PricingIssueCode.ENGINE_RECOMMENDED_BELOW_MINIMUM,
        "recommendedBusinessPrice",
        "ERROR",
        "recommendedBusinessPrice es menor que minimumSustainablePrice.",
      ),
    );
  }

  return issues;
}

function buildBreakdown(
  core: Extract<CuantoCobroCalculationResult, { status: "complete" }>,
): PricingInternalBreakdown {
  return {
    monthlyNeed: core.monthlyNeed,
    hourlyRate: core.hourlyRate,
    humanCost: core.humanCost,
    variableCosts: core.variableCosts,
    equipmentSavingsMonthly: core.equipmentSavings.totalMonthly,
    totalCameraWearCharged: core.cameraWearSummary.totalCameraWearCharged,
    totalCameraWearInformative: core.cameraWearSummary.totalCameraWearInformative,
    minimumSustainablePrice: core.minimumSustainablePrice,
    recommendedBusinessPrice: core.recommendedBusinessPrice,
    recommendedPriceLegacy: core.recommendedPrice,
    coreWarnings: [...core.warnings],
  };
}

/**
 * Pure mapper — sin I/O, sin mutación, sin fórmulas.
 */
export function mapCuantoCobroResult(
  coreResult: CuantoCobroCalculationResult,
  versions: MapCoreResultVersions,
): PricingCalculationResult {
  const prior = versions.priorWarnings ?? [];

  if (coreResult.status === "incomplete") {
    return {
      status: "INCOMPLETE",
      missingFields: [...coreResult.missingFields],
      issues: [
        ...prior,
        issue(
          PricingIssueCode.ENGINE_CORE_INCOMPLETE,
          "core",
          "ERROR",
          "El motor devolvió status incomplete.",
        ),
      ],
      approvalStatus: "NOT_REVIEWED",
      profileVersion: versions.profileVersion,
      templateVersion: versions.templateVersion,
      formulaVersion: versions.formulaVersion,
    };
  }

  const invariantIssues = validateCompleteInvariants(coreResult, versions);
  if (invariantIssues.length > 0) {
    return {
      status: "FAILED",
      issues: [...prior, ...invariantIssues],
      approvalStatus: "NOT_REVIEWED",
      profileVersion: versions.profileVersion,
      templateVersion: versions.templateVersion,
      formulaVersion: versions.formulaVersion,
    };
  }

  return {
    status: "READY",
    minimumSustainablePrice: coreResult.minimumSustainablePrice,
    recommendedBusinessPrice: coreResult.recommendedBusinessPrice,
    currency: coreResult.currency,
    warnings: [...prior, ...coreWarningsToIssues(coreResult.warnings)],
    profileVersion: versions.profileVersion,
    templateVersion: versions.templateVersion,
    formulaVersion: versions.formulaVersion,
    approvalStatus: "NOT_REVIEWED",
    breakdown: buildBreakdown(coreResult),
  };
}
