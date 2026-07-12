/**
 * Tipos del workflow editorial genérico (independiente del modelo Prisma).
 *
 * Soporta ARTICLE y EVENT con el mismo motor de transiciones.
 * Ver `event-adapter.contract.md` y `article-adapter.ts` / `event-adapter.ts`.
 */

/** Tipos de contenido editorial soportados por el núcleo. */
export type EditorialContentType = "ARTICLE" | "EVENT";

export const EDITORIAL_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];

/** Acción editorial explícita (el cliente nunca envía un status arbitrario). */
export type EditorialAction =
  | "SUBMIT_REVIEW"
  | "RETURN"
  | "APPROVE"
  | "PUBLISH"
  | "UNPUBLISH"
  | "ARCHIVE";

export const EDITORIAL_ACTIONS: readonly EditorialAction[] = [
  "SUBMIT_REVIEW",
  "RETURN",
  "APPROVE",
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
  /** Equivalente a Director (devolver, aprobar desde borrador, etc.). */
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
