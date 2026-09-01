import type { TemplateVariableDefinition } from "@repo/template-engine";
import {
  type TemplateV2VariableDefinition,
  type TemplateV2VariableGroup,
  type TemplateV2VariableUsableIn,
  type TemplateV2VariableValueType,
} from "./variable-catalog";
import {
  resolveTemplateVariablePlugin,
  type TemplateProductId,
} from "./resolve-template-product";

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
  /*
   * El catálogo que ve quien diseña se deriva del registro del motor, que es el mismo que valida
   * y renderiza. Antes eran dos listas: el editor ofrecía la foto del socio y la vista previa la
   * rechazaba como variable desconocida, porque FotoOffice existía en una y no en la otra.
   *
   * Derivarlo hace imposible ese desacuerdo: el editor no puede ofrecer nada que la emisión no
   * sepa resolver, y ninguna plataforma ve las variables de otra.
   */
  const registro = resolveTemplateVariablePlugin(product);
  const definiciones = registro.listVariableDefinitions();
  if (definiciones.length > 0) {
    const byGroup = new Map<string, TemplateV2VariableGroup>();
    for (const def of definiciones) {
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
  /*
   * Sin plugin no hay catálogo. Devolver el genérico sería exactamente lo que se quiere evitar:
   * una plataforma mostrando las variables de otra porque la suya no estaba definida.
   */
  return [];
}

export function getTextVariableGroupsForProduct(
  product: TemplateProductId | "unknown"
): TemplateV2VariableGroup[] {
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
