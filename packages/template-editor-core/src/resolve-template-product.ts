import {
  clickatonTemplateVariablesPlugin,
  createClickatonTemplateExampleData,
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  type TemplateVariableRegistry,
} from "@repo/template-engine";
import { createTemplatePreviewExampleData } from "./rendering/create-template-preview-example-data";
import { createSchoolTemplateEngineRegistry } from "./template-engine-compat";

export type TemplateProductId = "school" | "clickaton";

export function resolveTemplateProduct(
  meta: unknown
): TemplateProductId | "unknown" {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "school";
  const product = (meta as { product?: unknown }).product;
  if (product === "clickaton") return "clickaton";
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
  return createTemplatePreviewExampleData(overrides);
}

export function isKnownTemplateProduct(
  product: string
): product is TemplateProductId {
  return product === "school" || product === "clickaton";
}

/** Paths conocidos para validación de bindings según producto. */
export function getAllowedVariableKeysForProduct(
  product: TemplateProductId | "unknown"
): Set<string> {
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
  const reg = resolveTemplateVariablePlugin(
    product === "unknown" ? "school" : product
  );
  const def = reg.getVariableDefinition(key);
  if (!def) return false;
  const usable = def.usableIn ?? ["TEXT"];
  return usable.includes(target);
}

void schoolTemplateVariablesPlugin;
