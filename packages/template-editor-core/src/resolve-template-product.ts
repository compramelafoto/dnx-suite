import {
  clickatonTemplateVariablesPlugin,
  createClickatonTemplateExampleData,
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  type TemplateVariableRegistry,
} from "@repo/template-engine";
import { createTemplatePreviewExampleData } from "./rendering/create-template-preview-example-data";
import {
  FOTOFFICE_VARIABLE_GROUPS,
  createFotofficeExampleData,
} from "./variable-catalog-fotoffice";
import { createSchoolTemplateEngineRegistry } from "./template-engine-compat";

export type TemplateProductId = "school" | "clickaton" | "fotoffice";

export function resolveTemplateProduct(
  meta: unknown
): TemplateProductId | "unknown" {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "school";
  const product = (meta as { product?: unknown }).product;
  if (product === "clickaton") return "clickaton";
  if (product === "fotoffice") return "fotoffice";
  if (product === "school" || product == null || product === "") return "school";
  return "unknown";
}

/**
 * Selecciona el plugin de variables según metadata.product.
 * Desconocido → registry vacío (sin variables de dominio).
 */
export function resolveTemplateVariablePlugin(
  product: TemplateProductId | "unknown" | string
): TemplateVariableRegistry {
  if (product === "clickaton") {
    return createTemplateVariableRegistry([clickatonTemplateVariablesPlugin]);
  }
  if (product === "school") {
    return createSchoolTemplateEngineRegistry();
  }
  // producto desconocido: sin plugins de dominio
  return createTemplateVariableRegistry([]);
}

export function createExampleDataForProduct(
  product: TemplateProductId | "unknown" | string,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  if (product === "clickaton") {
    return createClickatonTemplateExampleData(overrides);
  }
  if (product === "fotoffice") {
    return createFotofficeExampleData(overrides);
  }
  return createTemplatePreviewExampleData(overrides);
}

export function isKnownTemplateProduct(
  product: string
): product is TemplateProductId {
  return (
    product === "school" || product === "clickaton" || product === "fotoffice"
  );
}

/** Paths conocidos para validación de bindings según producto. */
export function getAllowedVariableKeysForProduct(
  product: TemplateProductId | "unknown"
): Set<string> {
  if (product === "fotoffice") {
    return new Set(
      FOTOFFICE_VARIABLE_GROUPS.flatMap((g) => g.variables.map((v) => v.key))
    );
  }
  const reg = resolveTemplateVariablePlugin(
    product === "unknown" ? "school" : product
  );
  return new Set(reg.listVariableDefinitions().map((d) => d.path));
}

export function isVariableUsableInForProduct(
  product: TemplateProductId | "unknown",
  key: string,
  target: "TEXT" | "IMAGE"
): boolean {
  if (product === "fotoffice") {
    for (const group of FOTOFFICE_VARIABLE_GROUPS) {
      const def = group.variables.find((v) => v.key === key);
      if (def) return def.usableIn.includes(target);
    }
    return false;
  }
  const reg = resolveTemplateVariablePlugin(
    product === "unknown" ? "school" : product
  );
  const def = reg.getVariableDefinition(key);
  if (!def) return false;
  const usable = def.usableIn ?? ["TEXT"];
  return usable.includes(target);
}

void schoolTemplateVariablesPlugin;
