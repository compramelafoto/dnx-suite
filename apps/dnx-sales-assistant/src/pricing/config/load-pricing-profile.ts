import type {
  PricingConfigurationLoadResult,
  PricingProfile,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { validatePricingProfileReadiness } from "../profile/profile-readiness.js";
import { pricingProfileSchema } from "../profile/profile-schema.js";
import { isExamplePricingPath } from "../profile/user-facing-profile-guard.js";
import { loadJsonFile } from "./load-json-file.js";

export function loadPricingProfileFromPath(
  filePath: string,
): PricingConfigurationLoadResult<PricingProfile> {
  if (isExamplePricingPath(filePath)) {
    return {
      status: "INVALID",
      issues: [
        issue(
          PricingIssueCode.SCHEMA_INVALID,
          "profile",
          "ERROR",
          "Los archivos .example.json no pueden cargarse como perfil real.",
        ),
      ],
    };
  }
  const raw = loadJsonFile(filePath);
  if (raw.status === "NOT_FOUND") {
    return { status: "NOT_FOUND", issues: raw.issues };
  }
  if (raw.status === "INVALID") {
    return { status: "INVALID", issues: raw.issues };
  }

  const parsed = pricingProfileSchema.safeParse(raw.value);
  if (!parsed.success) {
    return {
      status: "INVALID",
      issues: parsed.error.issues.map((i) =>
        issue(
          PricingIssueCode.SCHEMA_INVALID,
          i.path.join(".") || "profile",
          "ERROR",
          i.message,
        ),
      ),
    };
  }

  const readiness = validatePricingProfileReadiness(parsed.data);
  if (!readiness.ready) {
    return {
      status: "NOT_CONFIGURED",
      issues: [...readiness.errors, ...readiness.warnings],
    };
  }

  return {
    status: "READY",
    value: parsed.data,
    warnings: readiness.warnings,
  };
}
