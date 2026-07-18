import type {
  PricingConfigurationIssue,
  PricingServiceTemplate,
  PricingServiceTemplateCatalog,
  PricingServiceTemplateReadiness,
  PricingTemplateCatalogReadiness,
} from "../models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { issue, looksLikePlaceholder, missingFieldsFromIssues } from "../issues.js";
import {
  pricingServiceTemplateCatalogSchema,
  pricingServiceTemplateSchema,
} from "./template-schema.js";

function validateConcept(
  concept: PricingServiceTemplate["concepts"][number],
  path: string,
): PricingConfigurationIssue[] {
  const out: PricingConfigurationIssue[] = [];
  if (!concept.configured) {
    return out;
  }

  if (looksLikePlaceholder(concept.label)) {
    out.push(
      issue(
        PricingIssueCode.PLACEHOLDER_VALUE,
        `${path}.label`,
        "ERROR",
        "Label de concepto con placeholder.",
      ),
    );
  }

  if (typeof concept.marginPercent === "number" && concept.marginPercent < 0) {
    out.push(
      issue(
        PricingIssueCode.TEMPLATE_MARGIN_NEGATIVE,
        `${path}.marginPercent`,
        "ERROR",
        "El margen no puede ser negativo.",
      ),
    );
  }

  const negatives: Array<[number | undefined, string]> = [
    [concept.hours, "hours"],
    [concept.hoursPerCoverageHour, "hoursPerCoverageHour"],
    [concept.directCost, "directCost"],
    [concept.quantity, "quantity"],
  ];
  for (const [value, key] of negatives) {
    if (typeof value === "number" && value < 0) {
      out.push(
        issue(
          PricingIssueCode.NEGATIVE_VALUE,
          `${path}.${key}`,
          "ERROR",
          "Valor negativo en concepto.",
        ),
      );
    }
  }

  switch (concept.calculationMode) {
    case "FIXED":
      if (
        (concept.type === "OWN_SERVICE" &&
          (concept.hours === undefined || concept.hours <= 0) &&
          (concept.directCost === undefined || concept.directCost <= 0)) ||
        (concept.type === "EXPENSE" &&
          (concept.directCost === undefined || concept.directCost <= 0)) ||
        (concept.type === "OUTSOURCED" &&
          (concept.directCost === undefined || concept.directCost <= 0)) ||
        (concept.type === "PRODUCT" &&
          (concept.directCost === undefined || concept.directCost <= 0))
      ) {
        out.push(
          issue(
            PricingIssueCode.TEMPLATE_CONCEPT_INCOMPLETE,
            path,
            "ERROR",
            "Concepto FIXED configurado sin datos suficientes.",
          ),
        );
      }
      break;
    case "PER_COVERAGE_HOUR":
      if (
        concept.hoursPerCoverageHour === undefined ||
        concept.hoursPerCoverageHour <= 0
      ) {
        out.push(
          issue(
            PricingIssueCode.TEMPLATE_CONCEPT_INCOMPLETE,
            `${path}.hoursPerCoverageHour`,
            "ERROR",
            "Falta multiplicador de horas por hora de cobertura.",
          ),
        );
      }
      break;
    case "PER_UNIT":
      if (concept.quantity === undefined || concept.quantity <= 0) {
        out.push(
          issue(
            PricingIssueCode.TEMPLATE_CONCEPT_INCOMPLETE,
            `${path}.quantity`,
            "ERROR",
            "Concepto PER_UNIT sin cantidad válida.",
          ),
        );
      }
      break;
    case "MANUAL":
      out.push(
        issue(
          PricingIssueCode.TEMPLATE_EDITING_MANUAL,
          `${path}.calculationMode`,
          "ERROR",
          "Concepto MANUAL bloquea automatización de precios.",
        ),
      );
      break;
  }

  return out;
}

export function validateServiceTemplateReadiness(
  template: PricingServiceTemplate,
): PricingServiceTemplateReadiness {
  const parsed = pricingServiceTemplateSchema.safeParse(template);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) =>
      issue(
        PricingIssueCode.SCHEMA_INVALID,
        i.path.join(".") || "template",
        "ERROR",
        i.message,
      ),
    );
    return {
      ready: false,
      configured: Boolean(template.configured),
      errors,
      warnings: [],
      missingFields: missingFieldsFromIssues(errors),
    };
  }

  const data = parsed.data as PricingServiceTemplate;
  const errors: PricingConfigurationIssue[] = [];
  const warnings: PricingConfigurationIssue[] = [];

  if (!data.configured) {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_NOT_CONFIGURED,
        "configured",
        "ERROR",
        "Plantilla no configurada.",
      ),
    );
  }

  if (!data.templateVersion.trim() || data.templateVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_VERSION_MISSING,
        "templateVersion",
        "ERROR",
        "Versión de plantilla ausente o unconfigured.",
      ),
    );
  }

  if (!data.formulaVersion.trim() || data.formulaVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.FORMULA_VERSION_MISSING,
        "formulaVersion",
        "ERROR",
        "Versión de fórmula ausente o unconfigured.",
      ),
    );
  }

  if (data.serviceType === ("UNKNOWN" as typeof data.serviceType)) {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_UNKNOWN_SERVICE,
        "serviceType",
        "ERROR",
        "UNKNOWN no es cotizable.",
      ),
    );
  }

  const { minimumHours, maximumHours } = data.coverage;
  if (
    !Number.isFinite(minimumHours) ||
    !Number.isFinite(maximumHours) ||
    minimumHours < 0 ||
    maximumHours < 0 ||
    minimumHours > maximumHours
  ) {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_COVERAGE_RANGE_INVALID,
        "coverage",
        "ERROR",
        "Rango de cobertura inválido (minimumHours <= maximumHours, no negativos).",
      ),
    );
  }

  if (data.editing.mode === "FIXED_HOURS") {
    if (
      data.editing.fixedHours === undefined ||
      !Number.isFinite(data.editing.fixedHours) ||
      data.editing.fixedHours < 0
    ) {
      errors.push(
        issue(
          PricingIssueCode.TEMPLATE_EDITING_FIXED_HOURS_MISSING,
          "editing.fixedHours",
          "ERROR",
          "FIXED_HOURS requiere fixedHours.",
        ),
      );
    }
  }

  if (data.editing.mode === "HOURS_PER_COVERAGE_HOUR") {
    if (
      data.editing.hoursPerCoverageHour === undefined ||
      !Number.isFinite(data.editing.hoursPerCoverageHour) ||
      data.editing.hoursPerCoverageHour <= 0
    ) {
      errors.push(
        issue(
          PricingIssueCode.TEMPLATE_EDITING_MULTIPLIER_MISSING,
          "editing.hoursPerCoverageHour",
          "ERROR",
          "HOURS_PER_COVERAGE_HOUR requiere hoursPerCoverageHour > 0.",
        ),
      );
    }
  }

  if (data.editing.mode === "MANUAL" && data.configured) {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_EDITING_MANUAL,
        "editing.mode",
        "ERROR",
        "Edición MANUAL bloquea cálculo automático.",
      ),
    );
  }

  const g = data.generalClientHours;
  for (const [key, value] of Object.entries(g)) {
    if (typeof value === "number" && value < 0) {
      errors.push(
        issue(
          PricingIssueCode.NEGATIVE_VALUE,
          `generalClientHours.${key}`,
          "ERROR",
          "Horas generales negativas.",
        ),
      );
    }
  }

  if (data.configured && data.concepts.length === 0) {
    errors.push(
      issue(
        PricingIssueCode.TEMPLATE_CONCEPT_INCOMPLETE,
        "concepts",
        "ERROR",
        "Plantilla configurada sin conceptos.",
      ),
    );
  }

  const conceptIds = new Set<string>();
  data.concepts.forEach((concept, index) => {
    if (conceptIds.has(concept.id)) {
      errors.push(
        issue(
          PricingIssueCode.TEMPLATE_CONCEPT_DUPLICATE_ID,
          `concepts[${index}].id`,
          "ERROR",
          `ID de concepto duplicado: ${concept.id}`,
        ),
      );
    }
    conceptIds.add(concept.id);
    errors.push(...validateConcept(concept, `concepts[${index}]`));
  });

  if (looksLikePlaceholder(data.notes ?? "")) {
    warnings.push(
      issue(
        PricingIssueCode.PLACEHOLDER_VALUE,
        "notes",
        "WARNING",
        "Notas con placeholder.",
      ),
    );
  }

  return {
    ready: errors.length === 0,
    configured: data.configured,
    errors,
    warnings,
    missingFields: missingFieldsFromIssues(errors),
  };
}

export function validateTemplateCatalogReadiness(
  catalog: PricingServiceTemplateCatalog,
): PricingTemplateCatalogReadiness {
  const parsed = pricingServiceTemplateCatalogSchema.safeParse(catalog);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) =>
      issue(
        PricingIssueCode.SCHEMA_INVALID,
        i.path.join(".") || "catalog",
        "ERROR",
        i.message,
      ),
    );
    return {
      ready: false,
      configured: Boolean(catalog.configured),
      errors,
      warnings: [],
      missingFields: missingFieldsFromIssues(errors),
    };
  }

  const data = parsed.data as PricingServiceTemplateCatalog;
  const errors: PricingConfigurationIssue[] = [];
  const warnings: PricingConfigurationIssue[] = [];

  if (!data.configured) {
    errors.push(
      issue(
        PricingIssueCode.CATALOG_NOT_CONFIGURED,
        "configured",
        "ERROR",
        "Catálogo no configurado.",
      ),
    );
  }

  if (!data.catalogVersion.trim() || data.catalogVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.CATALOG_VERSION_MISSING,
        "catalogVersion",
        "ERROR",
        "Versión de catálogo ausente o unconfigured.",
      ),
    );
  }

  if (!data.formulaVersion.trim() || data.formulaVersion === "unconfigured") {
    errors.push(
      issue(
        PricingIssueCode.FORMULA_VERSION_MISSING,
        "formulaVersion",
        "ERROR",
        "Versión de fórmula del catálogo ausente o unconfigured.",
      ),
    );
  }

  const serviceTypes = new Set<string>();
  const templateIds = new Set<string>();

  data.templates.forEach((template, index) => {
    if (serviceTypes.has(template.serviceType)) {
      errors.push(
        issue(
          PricingIssueCode.TEMPLATE_DUPLICATE_SERVICE,
          `templates[${index}].serviceType`,
          "ERROR",
          `Servicio duplicado: ${template.serviceType}`,
        ),
      );
    }
    serviceTypes.add(template.serviceType);

    if (templateIds.has(template.id)) {
      errors.push(
        issue(
          PricingIssueCode.TEMPLATE_DUPLICATE_ID,
          `templates[${index}].id`,
          "ERROR",
          `ID de plantilla duplicado: ${template.id}`,
        ),
      );
    }
    templateIds.add(template.id);

    const nested = validateServiceTemplateReadiness(template);
    for (const err of nested.errors) {
      errors.push({
        ...err,
        path: `templates[${index}].${err.path}`,
      });
    }
    for (const warn of nested.warnings) {
      warnings.push({
        ...warn,
        path: `templates[${index}].${warn.path}`,
      });
    }
  });

  return {
    ready: errors.length === 0,
    configured: data.configured,
    errors,
    warnings,
    missingFields: missingFieldsFromIssues(errors),
  };
}
