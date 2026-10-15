import { isContentError, type ContentError } from "@repo/content";

/**
 * Piezas puras del panel del blog, sin servidor ni base: se prueban solas
 * (`admin-utils.test.ts`) y las usan tanto las rutas de API como las pantallas.
 */

/**
 * Quita del cuerpo todo lo que defina a qué blog se escribe.
 *
 * La plataforma y la institución las pone siempre el servidor a partir de la sesión: si el
 * cliente las mandara y pasaran, alguien con permiso en una institución podría escribir en el
 * blog de otra. Los schemas de `@repo/content` ya descartan claves desconocidas; esto es la
 * segunda llave por si algún día dejan de hacerlo.
 */
export function stripClientScope(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const rest: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete rest.platform;
  delete rest.workspaceKey;
  delete rest.workspaceId;
  return rest;
}

export function parseListLimit(value: string | null | undefined, fallback = 50, max = 200): number {
  if (value === null || value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), max);
}

/** Un texto opcional de un formulario: vacío es `null`, y se corta en `max`. */
export function trimOptionalFormValue(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

export type OptionalTextResult = { ok: true; value: string | null | undefined } | { ok: false; field: string };

/**
 * Un campo de texto opcional de un JSON: `undefined` es "no tocar", `null` o vacío es
 * "borrar", y cualquier cosa que no sea texto es un error con el nombre del campo.
 */
export function readOptionalText(body: Record<string, unknown>, field: string, max: number): OptionalTextResult {
  const raw = body[field];
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, field };
  const t = raw.trim();
  return { ok: true, value: t ? t.slice(0, max) : null };
}

/** El tipo de imagen que se sube: sólo "hero" (portada) es distinto; cualquier otra cosa es biblioteca. */
export function parseUploadKind(value: FormDataEntryValue | null): "hero" | "media" {
  return value === "hero" ? "hero" : "media";
}

const RELATION_MESSAGES: Partial<Record<string, string>> = {
  CONTENT_CATEGORY_NOT_FOUND: "La categoría elegida no existe en tu blog.",
  CONTENT_AUTHOR_NOT_FOUND: "El autor elegido no existe en tu blog.",
  CONTENT_TAG_NOT_FOUND: "Uno o más tags no existen en tu blog.",
  CONTENT_MEDIA_NOT_FOUND: "La imagen elegida no existe en tu biblioteca.",
  CONTENT_RELATION_PLATFORM_MISMATCH: "La categoría, el autor o algún tag pertenece a otro blog.",
};

/** El mensaje para una relación inválida (categoría, autor, tag), o `null` si es otro error. */
export function mensajeDeRelacion(error: unknown): string | null {
  if (!isContentError(error)) return null;
  return RELATION_MESSAGES[error.code] ?? null;
}

export function contentErrorStatus(error: ContentError): number {
  switch (error.code) {
    case "CONTENT_NOT_FOUND":
    case "CONTENT_MEDIA_NOT_FOUND":
      return 404;
    case "CONTENT_SLUG_CONFLICT":
      return 409;
    case "CONTENT_CATEGORY_NOT_FOUND":
    case "CONTENT_AUTHOR_NOT_FOUND":
    case "CONTENT_TAG_NOT_FOUND":
    case "CONTENT_RELATION_PLATFORM_MISMATCH":
    case "CONTENT_INVALID_STATUS":
      return 400;
    // Plataforma o institución faltantes no son culpa de quien escribe: las pone el servidor,
    // así que si fallan es un error nuestro.
    default:
      return 500;
  }
}
