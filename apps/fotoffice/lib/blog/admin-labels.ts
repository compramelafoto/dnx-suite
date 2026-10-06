import type { ContentUiLabels } from "@repo/content-ui";

/**
 * Los textos de FOTOFFICE para el editor compartido. `@repo/content-ui` es neutro de marca y
 * habla de "artículo" por defecto; acá se ajusta lo que nombra al producto o a la institución.
 */

/** El editor toma el acento del panel (`--fo-accent`) en vez de su gris por defecto. */
export const BLOG_EDITOR_ACCENT_STYLE = {
  ["--content-ui-accent" as string]: "var(--fo-accent)",
} as const;

export const BLOG_EDITOR_LABELS: Partial<ContentUiLabels> = {
  titlePlaceholder: "Título del artículo",
  excerptPlaceholder: "Resumen corto: se ve en el listado del blog y en Google",
  authorEmpty: "Sin autor",
  fallbackShareNote: "Sin imagen destacada: al compartir el link se va a ver el logo de tu institución.",
  featureUncheckedNote:
    "El artículo no está publicado: se quitó el destacado. Sólo los artículos publicados se pueden destacar.",
  featurePublishFirst: "Para destacar un artículo en el blog, primero publicalo.",
  featureCheckbox: "Destacar en el blog",
  savedSuccess: "Artículo guardado.",
  saveError: "No se pudo guardar el artículo",
  deleteConfirm: "¿Eliminar este artículo? No se puede deshacer.",
  editorHint: "Usá H2 y H3 para los subtítulos. El título del artículo ya es el título principal de la página.",
};

/** Por ahora el blog de una institución sólo publica artículos: los otros tipos son de las plataformas DNX. */
export const BLOG_TYPE_LABELS: Record<string, string> = {
  BLOG: "Artículo",
};

export const BLOG_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
  SCHEDULED: "Programado",
};

/**
 * El estado que se muestra en el panel. Un artículo publicado con fecha futura está
 * "Programado": el blog público lo oculta hasta esa hora y después aparece solo.
 */
export function blogDisplayStatus(
  status: string,
  publishedAt: string | Date | null | undefined,
  now: Date = new Date(),
): string {
  if (status !== "PUBLISHED" || !publishedAt) return status;
  const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  return date.getTime() > now.getTime() ? "SCHEDULED" : status;
}

/** "lunes, 12 de octubre de 2026, 10:00", siempre en hora argentina. */
export function formatBlogDateTime(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "full",
    timeStyle: "short",
  });
}

export const BLOG_STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borradores" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "ARCHIVED", label: "Archivados" },
] as const;

/** Fecha corta en hora argentina, o "—" si no hay. */
export function formatBlogDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
