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
} from "@/lib/template-v2/variable-catalog";
import type { TemplateProductId } from "@/lib/template-v2/resolve-template-product";

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
  if (product !== "clickaton") {
    return getTemplateV2VariableGroupsForTextBlocks();
  }
  return getVariableGroupsForProduct("clickaton")
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
