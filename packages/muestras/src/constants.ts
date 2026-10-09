/**
 * Vocabulario de Muestras Fotográficas.
 *
 * Todo va como texto y no como enum de Prisma: el schema lo comparten todas las apps de la
 * suite y un enum que falte en alguna base rompe sus escrituras (mismo criterio que `Raffle`).
 */
export const ACTIVITY_TYPES = ["MUESTRA", "CHARLA", "TALLER", "SALIDA", "LIBRO", "PROYECCION", "OTRA"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  MUESTRA: "Muestra",
  CHARLA: "Charla",
  TALLER: "Taller",
  SALIDA: "Salida fotográfica",
  LIBRO: "Presentación de libro",
  PROYECCION: "Proyección",
  OTRA: "Otra actividad",
};

export const REVIEW_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "UNPUBLISHED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  APPROVED: "Publicada",
  REJECTED: "Rechazada",
  UNPUBLISHED: "Despublicada",
};

export const GALLERY_MODES = ["HIGHLIGHTS_UNTIL_CLOSED", "FULL"] as const;
export type GalleryMode = (typeof GALLERY_MODES)[number];

/** Tope de obras por muestra: alcanza para una muestra real y acota el almacenamiento. */
export const MAX_WORKS = 40;
/** Lo que se ve mientras la muestra está abierta, para no reemplazar la visita. */
export const MAX_HIGHLIGHTS = 12;
/** "Últimos días": cierra dentro de esta cantidad de días. */
export const LAST_DAYS_WINDOW = 7;

export function isActivityType(v: unknown): v is ActivityType {
  return typeof v === "string" && (ACTIVITY_TYPES as readonly string[]).includes(v);
}
export function isGalleryMode(v: unknown): v is GalleryMode {
  return typeof v === "string" && (GALLERY_MODES as readonly string[]).includes(v);
}
