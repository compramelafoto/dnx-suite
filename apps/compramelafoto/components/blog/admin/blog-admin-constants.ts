export const BLOG_POST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicado",
  ARCHIVED: "Archivado",
};

export const BLOG_POST_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-slate-100 text-slate-700",
};

export const BLOG_POST_TYPE_LABELS: Record<string, string> = {
  BLOG: "Artículo",
  FEATURE: "Funcionalidad",
  CASE_STUDY: "Caso de éxito",
  COMPARISON: "Comparativa",
};

/**
 * El servidor corre en hora universal: sin fijar la zona, un artículo publicado a las 22:15 de
 * Argentina figuraba con fecha del día siguiente a la 01:15.
 */
const BLOG_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function formatBlogAdminDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    timeZone: BLOG_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatBlogAdminDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    timeZone: BLOG_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
