import {
  fotofficeTemplateVariablesPlugin,
  fotorankTemplateVariablesPlugin,
  clickatonTemplateVariablesPlugin,
  createClickatonTemplateExampleData,
  createTemplateVariableRegistry,
  schoolTemplateVariablesPlugin,
  type TemplateVariableRegistry,
} from "@repo/template-engine";
import { createTemplatePreviewExampleData } from "./rendering/create-template-preview-example-data";
import { createFotofficeExampleData } from "./variable-catalog-fotoffice";
import { createSchoolTemplateEngineRegistry } from "./template-engine-compat";

export type TemplateProductId = "school" | "clickaton" | "fotoffice" | "fotorank";

export function resolveTemplateProduct(
  meta: unknown
): TemplateProductId | "unknown" {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "school";
  const product = (meta as { product?: unknown }).product;
  if (product === "clickaton") return "clickaton";
  if (product === "fotoffice") return "fotoffice";
  if (product === "fotorank") return "fotorank";
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
  if (product === "fotoffice") {
    return createTemplateVariableRegistry([fotofficeTemplateVariablesPlugin]);
  }
  if (product === "fotorank") {
    return createTemplateVariableRegistry([fotorankTemplateVariablesPlugin]);
  }
  if (product === "school") {
    return createSchoolTemplateEngineRegistry();
  }
  /*
   * Producto desconocido: registro vacío. Es deliberado y es la regla que pide el aislamiento —
   * ninguna plataforma hereda las variables de otra por descarte. Una plantilla cuyo producto no
   * se reconoce no valida, y eso es preferible a que valide contra el vocabulario equivocado.
   */
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
    product === "school" ||
    product === "clickaton" ||
    product === "fotoffice" ||
    product === "fotorank"
  );
}

/** Paths conocidos para validación de bindings según producto. */
export function getAllowedVariableKeysForProduct(
  product: TemplateProductId | "unknown"
): Set<string> {
  /*
   * Un producto desconocido no hereda las claves de otro. Antes caía en las de escuela: una
   * plantilla mal etiquetada validaba contra el vocabulario equivocado y parecía sana.
   */
  return new Set(
    resolveTemplateVariablePlugin(product).listVariableDefinitions().map((d) => d.path)
  );
}

export function isVariableUsableInForProduct(
  product: TemplateProductId | "unknown",
  key: string,
  target: "TEXT" | "IMAGE"
): boolean {
  const def = resolveTemplateVariablePlugin(product).getVariableDefinition(key);
  if (!def) return false;
  const usable = def.usableIn ?? ["TEXT"];
  return usable.includes(target);
}

void schoolTemplateVariablesPlugin;
