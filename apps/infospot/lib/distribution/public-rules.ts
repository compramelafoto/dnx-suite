/**
 * Regla pública central: solo status=PUBLISHED en superficies públicas / home.
 *
 * ETAPA 15: Se elimina el filtro contentTag=REAL. La visibilidad pública
 * depende únicamente del estado editorial PUBLISHED. El contenido DEMO que
 * quedó PUBLISHED antes de este cambio se migra a UNPUBLISHED vía SQL.
 */

export const PUBLIC_CONTENT_STATUS = "PUBLISHED" as const;

export const NON_PUBLIC_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "READY_TO_PUBLISH",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

/** Where Prisma reutilizable para eventos públicos. */
export function publicPublishedEventWhere(extra?: Record<string, unknown>) {
  return {
    status: PUBLIC_CONTENT_STATUS,
    excludeFromHomepage: false,
    ...extra,
  };
}

/** Where Prisma reutilizable para artículos públicos. */
export function publicPublishedArticleWhere(extra?: Record<string, unknown>) {
  return {
    status: PUBLIC_CONTENT_STATUS,
    excludeFromHomepage: false,
    ...extra,
  };
}

export function isPubliclyDistributable(input: {
  status?: string | null;
  contentTag?: string | null;
  excludeFromHomepage?: boolean | null;
}): boolean {
  if (input.status !== PUBLIC_CONTENT_STATUS) return false;
  if (input.excludeFromHomepage) return false;
  return true;
}
