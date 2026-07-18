import type {
  PreparedPricingJobResult,
  PricingConfigurationIssue,
  PricingProfile,
  PricingServiceTemplate,
} from "../models.js";
import type { CuantoCobroCompatibleCalculationInput } from "./compatible-models.js";
import { mapPreparedPricingJobToCompatibleQuote } from "./map-job.js";
import { mapPricingProfileToCompatibleProfile } from "./map-profile.js";
import { validateAdapterInput } from "./validate-adapter-input.js";

export type PricingAdapterResult =
  | {
      status: "READY";
      input: CuantoCobroCompatibleCalculationInput;
      profileVersion: string;
      templateVersion: string;
      formulaVersion: string;
      warnings: PricingConfigurationIssue[];
    }
  | {
      status: "INCOMPLETE";
      missingFields: string[];
      issues: PricingConfigurationIssue[];
    }
  | {
      status: "INVALID";
      issues: PricingConfigurationIssue[];
    }
  | {
      status: "UNSUPPORTED";
      reason: string;
      issues: PricingConfigurationIssue[];
    };

/**
 * Adaptador puro: perfil + plantilla + job preparado → DTO compatible con el motor.
 * No lee archivos, no calcula precios, no ejecuta calculateCuantoCobro.
 */
export function createCuantoCobroCompatibleInput(args: {
  profile: PricingProfile;
  template: PricingServiceTemplate;
  preparedJob: PreparedPricingJobResult;
}): PricingAdapterResult {
  const pre = validateAdapterInput(args);
  if (pre.status !== "OK") {
    if (pre.status === "UNSUPPORTED") {
      return {
        status: "UNSUPPORTED",
        reason: pre.reason ?? "UNSUPPORTED",
        issues: pre.issues,
      };
    }
    if (pre.status === "INVALID") {
      return { status: "INVALID", issues: pre.issues };
    }
    return {
      status: "INCOMPLETE",
      missingFields: pre.missingFields,
      issues: pre.issues,
    };
  }

  const preconditionWarnings = pre.warnings;

  const profileMap = mapPricingProfileToCompatibleProfile(args.profile);
  if (profileMap.status === "INVALID") {
    return { status: "INVALID", issues: profileMap.issues };
  }

  if (args.preparedJob.status !== "READY") {
    return {
      status: "INCOMPLETE",
      missingFields: ["preparedJob"],
      issues: preconditionWarnings,
    };
  }

  const jobMap = mapPreparedPricingJobToCompatibleQuote(args.preparedJob.job);
  if (jobMap.status === "UNSUPPORTED") {
    return {
      status: "UNSUPPORTED",
      reason: jobMap.reason,
      issues: jobMap.issues,
    };
  }
  if (jobMap.status === "INVALID") {
    return { status: "INVALID", issues: jobMap.issues };
  }

  const warnings: PricingConfigurationIssue[] = [
    ...preconditionWarnings,
    ...profileMap.warnings,
    ...jobMap.warnings,
  ];

  return {
    status: "READY",
    input: {
      profile: profileMap.profile,
      quote: jobMap.quote,
    },
    profileVersion: args.profile.profileVersion,
    templateVersion: args.template.templateVersion,
    formulaVersion: args.profile.formulaVersion,
    warnings,
  };
}
