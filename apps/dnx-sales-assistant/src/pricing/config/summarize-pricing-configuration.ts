import type {
  PricingConfigurationIssue,
  PricingConfigurationSafeSummary,
  PricingProfile,
  PricingServiceTemplateCatalog,
} from "../models.js";
import { validatePricingProfileReadiness } from "../profile/profile-readiness.js";
import { validateTemplateCatalogReadiness } from "../templates/template-readiness.js";
import type { PricingConfigurationLoadResult } from "../models.js";

function emptySummary(): PricingConfigurationSafeSummary {
  return {
    profileFound: false,
    profileConfigured: false,
    profileReady: false,
    currencyPresent: false,
    commercialPositioningPresent: false,
    enabledPersonalExpenseCount: 0,
    enabledBusinessExpenseCount: 0,
    equipmentItemCount: 0,
    catalogFound: false,
    catalogConfigured: false,
    catalogReady: false,
    configuredTemplateCount: 0,
    unconfiguredTemplateCount: 0,
    availableServiceTypes: [],
    errors: [],
    warnings: [],
  };
}

/**
 * Diagnóstico seguro: sin montos, costos, ingresos ni márgenes.
 */
export function summarizePricingConfiguration(input: {
  profileLoad: PricingConfigurationLoadResult<PricingProfile>;
  catalogLoad: PricingConfigurationLoadResult<PricingServiceTemplateCatalog>;
  /** Perfil parseado aunque no esté listo (opcional, para conteos). */
  profilePreview?: PricingProfile;
  catalogPreview?: PricingServiceTemplateCatalog;
}): PricingConfigurationSafeSummary {
  const summary = emptySummary();
  const errors: PricingConfigurationIssue[] = [];
  const warnings: PricingConfigurationIssue[] = [];

  const { profileLoad, catalogLoad, profilePreview, catalogPreview } = input;

  if (profileLoad.status === "NOT_FOUND") {
    errors.push(...profileLoad.issues);
  } else if (profileLoad.status === "INVALID") {
    summary.profileFound = true;
    errors.push(...profileLoad.issues);
  } else if (profileLoad.status === "NOT_CONFIGURED") {
    summary.profileFound = true;
    errors.push(...profileLoad.issues.filter((i) => i.severity === "ERROR"));
    warnings.push(...profileLoad.issues.filter((i) => i.severity === "WARNING"));
  } else {
    summary.profileFound = true;
    summary.profileReady = true;
    summary.profileConfigured = true;
    summary.profileVersion = profileLoad.value.profileVersion;
    summary.formulaVersion = profileLoad.value.formulaVersion;
    summary.currencyPresent = Boolean(profileLoad.value.currency.trim());
    summary.commercialPositioningPresent = Boolean(
      profileLoad.value.commercialPositioningId,
    );
    summary.enabledPersonalExpenseCount = profileLoad.value.personalExpenses.filter(
      (e) => e.enabled,
    ).length;
    summary.enabledBusinessExpenseCount = profileLoad.value.businessExpenses.filter(
      (e) => e.enabled,
    ).length;
    summary.equipmentItemCount = profileLoad.value.equipment.length;
    warnings.push(...profileLoad.warnings);
  }

  if (profilePreview && profileLoad.status !== "READY") {
    summary.profileFound = true;
    summary.profileConfigured = profilePreview.configured;
    summary.profileVersion = profilePreview.profileVersion;
    summary.formulaVersion = profilePreview.formulaVersion;
    summary.currencyPresent = Boolean(profilePreview.currency.trim());
    summary.commercialPositioningPresent = Boolean(
      profilePreview.commercialPositioningId,
    );
    summary.enabledPersonalExpenseCount = profilePreview.personalExpenses.filter(
      (e) => e.enabled,
    ).length;
    summary.enabledBusinessExpenseCount = profilePreview.businessExpenses.filter(
      (e) => e.enabled,
    ).length;
    summary.equipmentItemCount = profilePreview.equipment.length;
    const readiness = validatePricingProfileReadiness(profilePreview);
    summary.profileReady = readiness.ready;
  }

  if (catalogLoad.status === "NOT_FOUND") {
    errors.push(...catalogLoad.issues);
  } else if (catalogLoad.status === "INVALID") {
    summary.catalogFound = true;
    errors.push(...catalogLoad.issues);
  } else if (catalogLoad.status === "NOT_CONFIGURED") {
    summary.catalogFound = true;
    errors.push(...catalogLoad.issues.filter((i) => i.severity === "ERROR"));
    warnings.push(...catalogLoad.issues.filter((i) => i.severity === "WARNING"));
  } else {
    summary.catalogFound = true;
    summary.catalogReady = true;
    summary.catalogConfigured = true;
    summary.configuredTemplateCount = catalogLoad.value.templates.filter(
      (t) => t.configured,
    ).length;
    summary.unconfiguredTemplateCount = catalogLoad.value.templates.filter(
      (t) => !t.configured,
    ).length;
    summary.availableServiceTypes = catalogLoad.value.templates.map(
      (t) => t.serviceType,
    );
    warnings.push(...catalogLoad.warnings);
  }

  if (catalogPreview && catalogLoad.status !== "READY") {
    summary.catalogFound = true;
    summary.catalogConfigured = catalogPreview.configured;
    summary.configuredTemplateCount = catalogPreview.templates.filter(
      (t) => t.configured,
    ).length;
    summary.unconfiguredTemplateCount = catalogPreview.templates.filter(
      (t) => !t.configured,
    ).length;
    summary.availableServiceTypes = catalogPreview.templates.map((t) => t.serviceType);
    const readiness = validateTemplateCatalogReadiness(catalogPreview);
    summary.catalogReady = readiness.ready;
  }

  summary.errors = errors;
  summary.warnings = warnings;
  return summary;
}

/** Verifica que un resumen (o texto) no contenga montos evidentes. */
export function summaryContainsMoneyLikeValues(text: string): boolean {
  return /(?:\$|ARS|USD|EUR)\s*\d|\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?/.test(text);
}
