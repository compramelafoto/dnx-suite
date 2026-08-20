import { parseWebsiteDesignPresets } from "./design-presets";

/**
 * Determina si el borrador tiene cambios respecto de la versión publicada. Deliberadamente NO
 * se basa en `updatedAt` (guardar sin cambiar nada, o un `touch` accidental, produciría un falso
 * "hay cambios sin publicar"). Se compara el contenido normalizado de los mismos campos que
 * `publishWebsiteAction` copia al crear una versión — la fuente de verdad de "qué es publicable"
 * ya es esa lista de campos, así que reusarla acá evita que ambos lugares diverjan.
 *
 * `designPresetsJson` se normaliza con `parseWebsiteDesignPresets` antes de comparar (no se
 * compara el JSON crudo): `null` en el draft y `{headerPreset:"logo-left",...}` (los mismos
 * defaults, escritos explícitos) en la Version representan el mismo diseño — compararlos crudos
 * marcaría un falso "cambios sin publicar".
 *
 * No se agrega ninguna columna nueva para este cálculo: es una comparación derivada, calculada
 * en el momento de leer, no un estado persistido.
 */
export type WebsiteChangeStatus = "NEVER_PUBLISHED" | "UNPUBLISHED" | "PUBLISHED_NO_CHANGES" | "PUBLISHED_WITH_CHANGES";

type ComparableContent = {
  heroTitle: string | null;
  heroSubtitle: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  navJson: unknown;
  sectionsJson: unknown;
  designPresetsJson?: unknown;
};

/** Deep-equal estructural sobre valores JSON-safe, ignorando orden de claves de objeto. */
function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqualJson(item, b[i]));
  }

  const aKeys = Object.keys(a as Record<string, unknown>).sort();
  const bKeys = Object.keys(b as Record<string, unknown>).sort();
  if (aKeys.length !== bKeys.length || aKeys.some((k, i) => k !== bKeys[i])) return false;
  return aKeys.every((k) => deepEqualJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function contentEquals(a: ComparableContent, b: ComparableContent): boolean {
  return (
    a.heroTitle === b.heroTitle &&
    a.heroSubtitle === b.heroSubtitle &&
    a.seoTitle === b.seoTitle &&
    a.seoDescription === b.seoDescription &&
    deepEqualJson(a.navJson, b.navJson) &&
    deepEqualJson(a.sectionsJson, b.sectionsJson) &&
    deepEqualJson(parseWebsiteDesignPresets(a.designPresetsJson ?? null), parseWebsiteDesignPresets(b.designPresetsJson ?? null))
  );
}

/** `hasAnyVersionHistory` distingue "nunca publicado" de "publicado antes y despublicado ahora"
 * (`publishedVersionId` null en ambos casos) — solo afecta el copy de la UI, no la comparación. */
export function computeWebsiteChangeStatus(params: {
  draft: ComparableContent;
  publishedVersion: ComparableContent | null;
  hasAnyVersionHistory: boolean;
}): WebsiteChangeStatus {
  if (!params.publishedVersion) {
    return params.hasAnyVersionHistory ? "UNPUBLISHED" : "NEVER_PUBLISHED";
  }
  return contentEquals(params.draft, params.publishedVersion) ? "PUBLISHED_NO_CHANGES" : "PUBLISHED_WITH_CHANGES";
}
