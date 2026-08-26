import { TEMPLATE_V2_VARIABLE_MAP, type TemplateV2VariableDefinition } from "@/lib/template-v2/variable-catalog";
import { getVariableGroupsForProduct } from "@/lib/template-v2/variable-catalog-product";

/**
 * Contenido entre llaves: `{clave}`.
 * Acepta claves de catálogo (`student.fullName`) y alias legibles (`nombredelalumno`, `anio`).
 */
export const TEXT_BRACE_TOKEN_RE = /\{([^{}]+)\}/g;

/** Alias legibles → clave técnica del catálogo (UI y escritura manual). */
const BRACE_ALIAS_TO_KEY: Record<string, string> = {
  nombredelalumno: "student.fullName",
  nombredealumno: "student.fullName",
  nombrecompleto: "student.fullName",
  alumno: "student.fullName",
  apellido: "student.fullName",
  cliente: "buyer.fullName",
  comprador: "buyer.fullName",
  escuela: "school.name",
  colegio: "school.name",
  curso: "course.displayName",
  division: "course.displayName",
  anio: "event.dateFormatted",
  ano: "event.dateFormatted",
  fecha: "event.dateFormatted",
  pedido: "order.referenceShort",
  referencia: "order.referenceShort",
  qr: "order.fulfillmentQrUrl",
  fotografo: "photographer.displayName",
  // Clickatón (aliases que no chocan con school)
  participante: "participant.fullName",
  instagram: "participant.instagramHandle",
  ig: "participant.instagramHandle",
  ciudad: "participant.city",
  categoria: "participant.category",
  numero: "participant.numberFormatted",
  dorsal: "participant.numberFormatted",
  edicion: "edition.name",
};

const CLICKATON_KEY_SET = new Set(
  getVariableGroupsForProduct("clickaton").flatMap((g) => g.variables.map((v) => v.key))
);

function normalizeBraceSlug(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function catalogKeyFromBraceInner(inner: string): string | undefined {
  const raw = inner.trim();
  if (Object.hasOwn(TEMPLATE_V2_VARIABLE_MAP, raw) || CLICKATON_KEY_SET.has(raw)) {
    return raw;
  }

  const slug = normalizeBraceSlug(raw);
  if (BRACE_ALIAS_TO_KEY[slug]) return BRACE_ALIAS_TO_KEY[slug];

  for (const key of [...Object.keys(TEMPLATE_V2_VARIABLE_MAP), ...CLICKATON_KEY_SET]) {
    const compact = normalizeBraceSlug(key.replace(/\./g, ""));
    if (compact === slug) return key;
  }
  return undefined;
}

function resolvedValueForKey(
  key: string,
  resolvedVariables: Record<string, unknown> | undefined,
  def: TemplateV2VariableDefinition | undefined
): string | null {
  const dyn = resolvedVariables?.[key];
  if (dyn !== undefined && dyn !== null && String(dyn).trim() !== "") {
    return String(dyn);
  }
  if (def?.defaultFallback != null && String(def.defaultFallback).trim() !== "") {
    return String(def.defaultFallback);
  }
  return null;
}

/**
 * Vista previa / render: reemplaza `{tokens}` por valores resueltos cuando se reconoce la variable.
 * Tokens desconocidos se dejan tal cual (no rompe el texto).
 */
export function resolveBracePlaceholdersInText(
  raw: string,
  resolvedVariables?: Record<string, unknown>
): string {
  if (!raw.includes("{")) return raw;
  return raw.replace(TEXT_BRACE_TOKEN_RE, (full, inner: string) => {
    const key = catalogKeyFromBraceInner(String(inner));
    if (!key) return full;
    const def = Object.hasOwn(TEMPLATE_V2_VARIABLE_MAP, key)
      ? TEMPLATE_V2_VARIABLE_MAP[key]
      : undefined;
    const val = resolvedValueForKey(key, resolvedVariables, def);
    if (val === null) return full;
    return val;
  });
}

/** Insertar desde UI: siempre clave canónica del catálogo. */
export function braceSnippetForCatalogKey(key: string): string {
  return `{${key}}`;
}
