import {
  EDITORIAL_STATUSES,
  type EditorialAction,
  type EditorialStatus,
} from "./types";

export { EDITORIAL_STATUSES, EDITORIAL_ACTIONS } from "./types";
export type {
  EditorialAction,
  EditorialContentType,
  EditorialStatus,
  EditorialActorCapabilities,
  EditorialWorkflowSubject,
  EditorialTransitionContext,
  EditorialDenialCode,
  EditorialPermissionResult,
  EditorialTransitionResolution,
} from "./types";

/** Labels genéricos (neutros). El adaptador de Article puede usar copy propio. */
export const EDITORIAL_STATUS_LABELS: Record<EditorialStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  READY_TO_PUBLISH: "Listo para publicar",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  ARCHIVED: "Archivado",
};

export const EDITORIAL_ACTION_LABELS: Record<EditorialAction, string> = {
  SUBMIT_REVIEW: "Enviar a revisión",
  RETURN: "Devolver con observación",
  APPROVE: "Aprobar para publicar",
  PUBLISH: "Publicar",
  UNPUBLISH: "Despublicar",
  ARCHIVE: "Archivar",
};

export function isEditorialStatus(value: string): value is EditorialStatus {
  return (EDITORIAL_STATUSES as readonly string[]).includes(value);
}
