import {
  defaultProfileLocalPath,
  defaultTemplatesLocalPath,
} from "../config/paths.js";
import { loadPricingProfileFromPath } from "../config/load-pricing-profile.js";
import { loadServiceTemplatesFromPath } from "../config/load-service-templates.js";
import { tryParseCatalogPreview, tryParseProfilePreview } from "../config/parse-previews.js";
import {
  summarizePricingConfiguration,
  summaryContainsMoneyLikeValues,
} from "../config/summarize-pricing-configuration.js";
import type { PricingConfigurationSafeSummary } from "../models.js";

export type PricingValidateOptions = {
  profilePath?: string;
  templatesPath?: string;
};

export type PricingValidateResult = {
  exitCode: number;
  summary: PricingConfigurationSafeSummary;
  lines: string[];
};

function formatSummaryLines(summary: PricingConfigurationSafeSummary): string[] {
  const lines = [
    "DNX pricing validate — resumen seguro (sin montos)",
    `perfil encontrado: ${summary.profileFound}`,
    `perfil configurado: ${summary.profileConfigured}`,
    `perfil listo: ${summary.profileReady}`,
    `versión perfil: ${summary.profileVersion ?? "(n/a)"}`,
    `versión fórmula: ${summary.formulaVersion ?? "(n/a)"}`,
    `moneda presente: ${summary.currencyPresent}`,
    `posicionamiento presente: ${summary.commercialPositioningPresent}`,
    `gastos personales habilitados (cantidad): ${summary.enabledPersonalExpenseCount}`,
    `gastos negocio habilitados (cantidad): ${summary.enabledBusinessExpenseCount}`,
    `ítems de equipo (cantidad): ${summary.equipmentItemCount}`,
    `catálogo encontrado: ${summary.catalogFound}`,
    `catálogo configurado: ${summary.catalogConfigured}`,
    `catálogo listo: ${summary.catalogReady}`,
    `plantillas configuradas: ${summary.configuredTemplateCount}`,
    `plantillas no configuradas: ${summary.unconfiguredTemplateCount}`,
    `tipos de servicio: ${summary.availableServiceTypes.join(", ") || "(ninguno)"}`,
    `errores: ${summary.errors.length}`,
    `warnings: ${summary.warnings.length}`,
  ];

  for (const err of summary.errors.slice(0, 20)) {
    lines.push(`  ERROR [${err.code}] ${err.path}: ${err.message}`);
  }
  if (summary.errors.length > 20) {
    lines.push(`  … ${summary.errors.length - 20} errores más`);
  }
  for (const warn of summary.warnings.slice(0, 10)) {
    lines.push(`  WARN [${warn.code}] ${warn.path}: ${warn.message}`);
  }

  return lines;
}

/**
 * Validación local de perfil + plantillas.
 * Exit 0 solo si ambos están READY.
 */
export function runPricingValidate(
  options: PricingValidateOptions = {},
): PricingValidateResult {
  const profilePath = options.profilePath ?? defaultProfileLocalPath();
  const templatesPath = options.templatesPath ?? defaultTemplatesLocalPath();

  const profileLoad = loadPricingProfileFromPath(profilePath);
  const catalogLoad = loadServiceTemplatesFromPath(templatesPath);
  const profilePreview = tryParseProfilePreview(profilePath);
  const catalogPreview = tryParseCatalogPreview(templatesPath);

  const summary = summarizePricingConfiguration({
    profileLoad,
    catalogLoad,
    profilePreview,
    catalogPreview,
  });

  const lines = [
    `perfil: ${profilePath}`,
    `plantillas: ${templatesPath}`,
    ...formatSummaryLines(summary),
  ];

  const text = lines.join("\n");
  if (summaryContainsMoneyLikeValues(text)) {
    lines.push("ERROR interno: el resumen no debe contener montos.");
    return { exitCode: 2, summary, lines };
  }

  const exitCode =
    profileLoad.status === "READY" && catalogLoad.status === "READY" ? 0 : 1;

  if (exitCode !== 0) {
    lines.push(
      "Resultado: NO LISTO. Copiá los .example.json a .local.json y completá valores reales.",
    );
  } else {
    lines.push("Resultado: LISTO para etapas posteriores de cálculo.");
  }

  return { exitCode, summary, lines };
}
