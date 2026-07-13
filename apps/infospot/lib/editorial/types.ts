/**
 * Tipos del workflow editorial genérico (independiente del modelo Prisma).
 *
 * Workflow visible (ETAPA 15):
 *   BORRADOR → EN REVISIÓN → PUBLICADO → DESPUBLICADO → ARCHIVADO
 *
 * `READY_TO_PUBLISH` permanece en el enum Prisma solo por compatibilidad de DB;
 * la app lo trata como alias legado de `IN_REVIEW` y nunca lo escribe.
 */

/** Tipos de contenido editorial soportados por el núcleo. */
export type EditorialContentType = "ARTICLE" | "EVENT";

/**
 * Estados persistidos (incluye legado `READY_TO_PUBLISH` para lecturas).
 * La UI solo expone los cinco estados del workflow simplificado.
 */
export const EDITORIAL_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

/** Estados visibles al redactor (sin READY_TO_PUBLISH). */
export const VISIBLE_EDITORIAL_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type VisibleEditorialStatus = (typeof VISIBLE_EDITORIAL_STATUSES)[number];

/**
 * Intención de publicación.
 * Hoy solo se usa `NOW` (“Publicar ahora”).
 * `SCHEDULED` queda reservado para publicaciones programadas futuras.
 */
export type EditorialPublishIntent = "NOW" | "SCHEDULED";

/** Acción editorial explícita (el cliente nunca envía un status arbitrario). */
export type EditorialAction =
  | "SUBMIT_REVIEW"
  | "RETURN"
  | "APPROVE"
  | "PUBLISH"
  | "UNPUBLISH"
  | "ARCHIVE";

/**
 * Acciones del workflow simplificado.
 * `APPROVE` sigue en el tipo por compatibilidad de API legacy, pero no se ofrece en UI
 * y el núcleo lo resuelve como publicación directa (`PUBLISH`).
 */
export const EDITORIAL_ACTIONS: readonly EditorialAction[] = [
  "SUBMIT_REVIEW",
  "RETURN",
  "APPROVE",
  "PUBLISH",
  "UNPUBLISH",
  "ARCHIVE",
] as const;

/** Acciones que el panel editorial puede mostrar. */
export const VISIBLE_EDITORIAL_ACTIONS: readonly EditorialAction[] = [
  "SUBMIT_REVIEW",
  "RETURN",
  "PUBLISH",
  "UNPUBLISH",
  "ARCHIVE",
] as const;

/**
 * Capacidades del actor, ya resueltas por el adaptador de contenido.
 * El núcleo no conoce roles Prisma ni funciones `canPublishInfoSpot*`.
 */
export type EditorialActorCapabilities = {
  /** Puede publicar / despublicar directamente. */
  canPublish: boolean;
  /** Equivalente a Director (gestión / settings). */
  isDirector: boolean;
};

/**
 * Sujeto mínimo para una transición. El adaptador completa permisos y metadatos.
 */
export type EditorialWorkflowSubject = {
  contentType: EditorialContentType;
  status: EditorialStatus;
};

/**
 * Contexto de una transición solicitada.
 * Metadatos de devolución / revisión son opcionales (hoy los usa Article).
 */
export type EditorialTransitionContext = {
  contentType: EditorialContentType;
  from: EditorialStatus;
  action: EditorialAction;
  actor: EditorialActorCapabilities;
  /**
   * Metadatos opcionales del contenido (p. ej. timestamps de devolución).
   * El núcleo actual no los usa para permisos; se reservan para reglas futuras.
   */
  meta?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
    /** Reservado: fecha de publicación programada (no implementado). */
    scheduledPublishAt?: Date | string | null;
  };
};

/** Códigos de rechazo estables; el adaptador traduce a copy de producto. */
export type EditorialDenialCode =
  | "NO_SESSION"
  | "INVALID_TRANSITION"
  | "SUBMIT_NOT_DRAFT"
  | "RETURN_NOT_DIRECTOR"
  | "RETURN_NOT_IN_REVIEW"
  | "APPROVE_NO_PERMISSION"
  | "APPROVE_WRONG_STATUS"
  | "APPROVE_DRAFT_NOT_DIRECTOR"
  | "PUBLISH_REQUIRES_DRAFT"
  | "PUBLISH_NOT_PUBLISHABLE"
  | "UNPUBLISH_NO_PERMISSION"
  | "UNPUBLISH_NOT_PUBLISHED"
  | "ALREADY_ARCHIVED"
  | "UNKNOWN_ACTION";

export type EditorialPermissionResult =
  | { ok: true }
  | { ok: false; code: EditorialDenialCode };

export type EditorialTransitionResolution =
  | { ok: false; code: EditorialDenialCode }
  | {
      ok: true;
      /** Estado destino efectivo (puede diferir del nominal de la acción). */
      targetStatus: EditorialStatus;
      /**
       * `submit_via_publish`: usuario sin publicación directa pide publicar
       * desde DRAFT → el destino efectivo es IN_REVIEW.
       */
      via: "direct" | "submit_via_publish";
    };

/** Normaliza estados legado a los visibles del workflow. */
export function normalizeVisibleEditorialStatus(
  status: EditorialStatus | string,
): VisibleEditorialStatus {
  if (status === "READY_TO_PUBLISH") return "IN_REVIEW";
  if (
    status === "DRAFT" ||
    status === "IN_REVIEW" ||
    status === "PUBLISHED" ||
    status === "UNPUBLISHED" ||
    status === "ARCHIVED"
  ) {
    return status;
  }
  return "DRAFT";
}
