/**
 * Copy Clickatón para el CMS compartido (`@repo/content-ui`).
 * El paquete es neutro de marca: los nombres de producto viven acá.
 */
import type { ContentUiLabels } from "@repo/content-ui";

/** Amarillo de marca Clickatón (`--ck-core-brand`). Los wrappers lo inyectan como CSS var. */
export const CLICKATON_CONTENT_ACCENT = "#ffc400";

/** Estilo inline para setear el acento del CMS compartido. */
export const CLICKATON_CONTENT_ACCENT_STYLE = {
  ["--content-ui-accent" as string]: CLICKATON_CONTENT_ACCENT,
} as const;

export const CLICKATON_CONTENT_LABELS: Partial<ContentUiLabels> = {
  titlePlaceholder: "Título de la nota",
  excerptPlaceholder: "Resumen para listados y buscadores",
  fallbackShareNote:
    "Sin imagen destacada: al compartir el link se mostrará el logo de Clickatón.",
  featureUncheckedNote:
    "La nota no está publicada: se quitó el destacado. Solo las notas publicadas pueden destacarse en el blog de Clickatón.",
  featurePublishFirst: "Para destacar una nota en el blog, primero publicala.",
  featureCheckbox: "Destacar en el blog",
  savedSuccess: "Nota guardada correctamente.",
  saveError: "Error guardando la nota",
  deleteConfirm: "¿Eliminar esta nota permanentemente?",
  editorHint:
    "Usá H2–H6 para los títulos internos. El H1 de la página es el título de la nota.",
};

/** Tipos de contenido habilitados en Clickatón (MVP: solo nota de blog). */
export const CLICKATON_CONTENT_TYPE_LABELS: Record<string, string> = {
  BLOG: "Nota",
  FEATURE: "Novedad",
  CASE_STUDY: "Historia de sede",
  COMPARISON: "Comparativa",
};

export const CLICKATON_CONTENT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  ARCHIVED: "Archivada",
};
