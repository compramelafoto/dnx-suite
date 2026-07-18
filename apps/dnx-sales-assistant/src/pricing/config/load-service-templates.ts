import type {
  PricingConfigurationLoadResult,
  PricingServiceTemplateCatalog,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue } from "../issues.js";
import { validateTemplateCatalogReadiness } from "../templates/template-readiness.js";
import { pricingServiceTemplateCatalogSchema } from "../templates/template-schema.js";
import { isExamplePricingPath } from "../profile/user-facing-profile-guard.js";
import { loadJsonFile } from "./load-json-file.js";

export function loadServiceTemplatesFromPath(
  filePath: string,
): PricingConfigurationLoadResult<PricingServiceTemplateCatalog> {
  if (isExamplePricingPath(filePath)) {
    return {
      status: "INVALID",
      issues: [
        issue(
          PricingIssueCode.SCHEMA_INVALID,
          "catalog",
          "ERROR",
          "Los archivos .example.json no pueden cargarse como catálogo real.",
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

  const parsed = pricingServiceTemplateCatalogSchema.safeParse(raw.value);
  if (!parsed.success) {
    return {
      status: "INVALID",
      issues: parsed.error.issues.map((i) =>
        issue(
          PricingIssueCode.SCHEMA_INVALID,
          i.path.join(".") || "catalog",
          "ERROR",
          i.message,
        ),
      ),
    };
  }

  const catalog = parsed.data as PricingServiceTemplateCatalog;
  const readiness = validateTemplateCatalogReadiness(catalog);
  if (!readiness.ready) {
    return {
      status: "NOT_CONFIGURED",
      issues: [...readiness.errors, ...readiness.warnings],
    };
  }

  return {
    status: "READY",
    value: catalog,
    warnings: readiness.warnings,
  };
}
