import {
  EDITORIAL_STATUSES,
  VISIBLE_EDITORIAL_STATUSES,
  type EditorialAction,
  type EditorialStatus,
  type VisibleEditorialStatus,
} from "./types";

export {
  EDITORIAL_STATUSES,
  EDITORIAL_ACTIONS,
  VISIBLE_EDITORIAL_STATUSES,
  VISIBLE_EDITORIAL_ACTIONS,
  normalizeVisibleEditorialStatus,
} from "./types";
export type {
  EditorialAction,
  EditorialContentType,
  EditorialStatus,
  VisibleEditorialStatus,
  EditorialPublishIntent,
  EditorialActorCapabilities,
  EditorialWorkflowSubject,
  EditorialTransitionContext,
  EditorialDenialCode,
  EditorialPermissionResult,
  EditorialTransitionResolution,
} from "./types";

/** Labels genéricos (neutros). READY_TO_PUBLISH se muestra igual que EN REVISIÓN. */
export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  READY_TO_PUBLISH: "En revisión",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  ARCHIVED: "Archivado",
};

export const EDITORIAL_ACTION_LABELS: Record<EditorialAction, string> = {
  SUBMIT_REVIEW: "Enviar a revisión",
  RETURN: "Devolver con observación",
  APPROVE: "Publicar ahora",
  PUBLISH: "Publicar ahora",
  UNPUBLISH: "Despublicar",
  ARCHIVE: "Archivar",
};

export function isEditorialStatus(value: string): value is EditorialStatus {
  return (EDITORIAL_STATUSES as readonly string[]).includes(value);
}

export function isVisibleEditorialStatus(
  value: string,
): value is VisibleEditorialStatus {
  return (VISIBLE_EDITORIAL_STATUSES as readonly string[]).includes(value);
}
