import {
  clickatonTemplateVariablesPlugin,
  type TemplateVariableDefinition,
} from "@repo/template-engine";
import {
  getTemplateV2VariableGroupsForTextBlocks,
  TEMPLATE_V2_VARIABLE_CATALOG,
  type TemplateV2VariableDefinition,
  type TemplateV2VariableGroup,
  type TemplateV2VariableUsableIn,
  type TemplateV2VariableValueType,
} from "./variable-catalog";
import { FOTOFFICE_VARIABLE_GROUPS } from "./variable-catalog-fotoffice";
import type { TemplateProductId } from "./resolve-template-product";

function mapValueType(
  t: TemplateVariableDefinition["valueType"]
): TemplateV2VariableValueType {
  if (t === "image") return "imageUrl";
  if (t === "qrUrl") return "qrUrl";
  if (t === "date") return "date";
  return "string";
}

function toEditorDef(def: TemplateVariableDefinition): TemplateV2VariableDefinition {
  return {
    key: def.path,
    label: def.label,
    group: (def.group ?? "card") as TemplateV2VariableDefinition["group"],
    valueType: mapValueType(def.valueType),
    usableIn: (def.usableIn ?? ["TEXT"]) as TemplateV2VariableUsableIn[],
    requiredInV1: Boolean(def.required),
    defaultFallback: def.defaultFallback ?? null,
    formatters: (def.formatters ?? ["none"]) as TemplateV2VariableDefinition["formatters"],
    description: def.description ?? def.label,
    sourcePath: def.path,
  };
}

/** Catálogo UI según producto de la plantilla. */
export function getVariableGroupsForProduct(
  product: TemplateProductId | "unknown"
): TemplateV2VariableGroup[] {
  if (product === "fotoffice") return FOTOFFICE_VARIABLE_GROUPS;
  if (product === "clickaton") {
    const byGroup = new Map<string, TemplateV2VariableGroup>();
    for (const def of clickatonTemplateVariablesPlugin.definitions) {
      const groupId = def.group ?? "card";
      const label = def.groupLabel ?? groupId;
      if (!byGroup.has(groupId)) {
        byGroup.set(groupId, {
          id: groupId as TemplateV2VariableGroup["id"],
          label,
          variables: [],
        });
      }
      byGroup.get(groupId)!.variables.push(toEditorDef(def));
    }
    return Array.from(byGroup.values());
  }
  return TEMPLATE_V2_VARIABLE_CATALOG.groups;
}

export function getTextVariableGroupsForProduct(
  product: TemplateProductId | "unknown"
): TemplateV2VariableGroup[] {
  if (product !== "clickaton" && product !== "fotoffice") {
    return getTemplateV2VariableGroupsForTextBlocks();
  }
  return getVariableGroupsForProduct(product)
    .map((g) => ({
      ...g,
      variables: g.variables.filter((v) => v.usableIn.includes("TEXT")),
    }))
    .filter((g) => g.variables.length > 0);
}

export function getVariableByKeyForProduct(
  product: TemplateProductId | "unknown",
  key: string
): TemplateV2VariableDefinition | undefined {
  for (const g of getVariableGroupsForProduct(product)) {
    const found = g.variables.find((v) => v.key === key);
    if (found) return found;
  }
  return undefined;
}

/**
 * Las imágenes que el editor puede insertar como bloque atado a un dato.
 *
 * Sale del propio catálogo del producto: una variable de imagen usable en bloques de imagen es,
 * por definición, una imagen insertable. Así el riel de herramientas no tiene su propia lista
 * que mantener al día — era el defecto que dejaba a FotoOffice sin forma de poner la foto del
 * socio mientras ofrecía el logo de una escuela que no existe en ese producto.
 */
export function getInsertableImageVariablesForProduct(
  product: TemplateProductId | "unknown"
): TemplateV2VariableDefinition[] {
  return getVariableGroupsForProduct(product)
    .flatMap((g) => g.variables)
    .filter((v) => v.valueType === "imageUrl" && v.usableIn.includes("IMAGE"));
}
