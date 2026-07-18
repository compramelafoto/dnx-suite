import type {
  PreparedPricingJobResult,
  PricingConfigurationIssue,
  PricingProfile,
  PricingServiceTemplate,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { validatePricingProfileReadiness } from "../profile/profile-readiness.js";
import { validateServiceTemplateReadiness } from "../templates/template-readiness.js";

export type AdapterPreconditions =
  | { status: "OK"; warnings: PricingConfigurationIssue[] }
  | {
      status: "INCOMPLETE" | "INVALID" | "UNSUPPORTED";
      reason?: string;
      issues: PricingConfigurationIssue[];
      missingFields: string[];
    };

export function validateAdapterInput(input: {
  profile: PricingProfile;
  template: PricingServiceTemplate;
  preparedJob: PreparedPricingJobResult;
}): AdapterPreconditions {
  const warnings: PricingConfigurationIssue[] = [];
  const issues: PricingConfigurationIssue[] = [];
  const missingFields: string[] = [];

  const profileReady = validatePricingProfileReadiness(input.profile);
  if (!profileReady.ready) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_PROFILE_NOT_READY,
        "profile",
        "ERROR",
        "El perfil no está listo para adaptar.",
      ),
      ...profileReady.errors,
    );
    missingFields.push(...profileReady.missingFields);
  } else {
    warnings.push(...profileReady.warnings);
  }

  const templateReady = validateServiceTemplateReadiness(input.template);
  if (!templateReady.ready) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_TEMPLATE_NOT_READY,
        "template",
        "ERROR",
        "La plantilla no está lista para adaptar.",
      ),
      ...templateReady.errors,
    );
    missingFields.push(...templateReady.missingFields);
  } else {
    warnings.push(...templateReady.warnings);
  }

  if (input.preparedJob.status === "UNSUPPORTED") {
    return {
      status: "UNSUPPORTED",
      reason: input.preparedJob.reason,
      issues: [
        issue(
          PricingIssueCode.ADAPTER_UNSUPPORTED_SERVICE,
          "preparedJob",
          "ERROR",
          input.preparedJob.reason,
        ),
      ],
      missingFields: [],
    };
  }

  if (input.preparedJob.status === "INCOMPLETE") {
    return {
      status: "INCOMPLETE",
      issues: [
        issue(
          PricingIssueCode.ADAPTER_JOB_NOT_READY,
          "preparedJob",
          "ERROR",
          "El job preparado está incompleto.",
        ),
      ],
      missingFields: input.preparedJob.missingFields,
    };
  }

  const profileVersion = input.profile.profileVersion;
  const templateVersion = input.template.templateVersion;
  const profileFormula = input.profile.formulaVersion;
  const templateFormula = input.template.formulaVersion;

  for (const [label, value] of [
    ["profile.profileVersion", profileVersion],
    ["template.templateVersion", templateVersion],
    ["profile.formulaVersion", profileFormula],
    ["template.formulaVersion", templateFormula],
  ] as const) {
    if (!value || value === "unconfigured") {
      issues.push(
        issue(
          PricingIssueCode.ADAPTER_VERSION_UNCONFIGURED,
          label,
          "ERROR",
          "Versión ausente o unconfigured.",
        ),
      );
      missingFields.push(label);
    }
  }

  if (
    profileFormula &&
    templateFormula &&
    profileFormula !== "unconfigured" &&
    templateFormula !== "unconfigured" &&
    profileFormula !== templateFormula
  ) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_FORMULA_VERSION_MISMATCH,
        "formulaVersion",
        "ERROR",
        "formulaVersion del perfil y de la plantilla no coinciden.",
      ),
    );
  }

  if (
    input.preparedJob.status === "READY" &&
    input.preparedJob.templateVersion !== input.template.templateVersion
  ) {
    issues.push(
      issue(
        PricingIssueCode.ADAPTER_FORMULA_VERSION_MISMATCH,
        "templateVersion",
        "ERROR",
        "templateVersion del job no coincide con la plantilla.",
      ),
    );
  }

  if (issues.length > 0) {
    const hasUnsupported = issues.some(
      (i) => i.code === PricingIssueCode.ADAPTER_UNSUPPORTED_SERVICE,
    );
    const hasInvalid = issues.some(
      (i) =>
        i.code === PricingIssueCode.ADAPTER_FORMULA_VERSION_MISMATCH ||
        i.code === PricingIssueCode.ADAPTER_INVALID_AVAILABILITY,
    );
    return {
      status: hasUnsupported ? "UNSUPPORTED" : hasInvalid ? "INVALID" : "INCOMPLETE",
      issues,
      missingFields: [...new Set(missingFields)],
    };
  }

  return { status: "OK", warnings };
}
