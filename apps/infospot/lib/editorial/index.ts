/**
 * API pública del módulo editorial genérico.
 * Preferir imports desde aquí para código nuevo; `article-status.ts` sigue
 * siendo la fachada de compatibilidad para callers existentes.
 */

export {
  EDITORIAL_STATUSES,
  EDITORIAL_ACTIONS,
  EDITORIAL_STATUS_LABELS,
  EDITORIAL_ACTION_LABELS,
  isEditorialStatus,
} from "./editorial-status";

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

export {
  canTransitionEditorialStatus,
  targetStatusForEditorialAction,
  resolveEffectiveEditorialTarget,
  canPerformEditorialTransition,
  resolveEditorialTransition,
  availableEditorialActionsFor,
  expectedEditorialActionHint,
  formatInvalidTransitionReason,
} from "./editorial-workflow-core";

export {
  ARTICLE_STATUSES,
  STATUS_LABELS,
  isArticleStatus,
  hasPendingReturn,
  articleActorCapabilities,
  canTransitionStatus,
  targetStatusForAction,
  canPerformEditorialAction,
  availableEditorialActions,
  expectedActionHint,
  planArticleEditorialPersist,
  articlePrismaDataFromPlan,
  articleDenialReason,
} from "./article-adapter";

export type {
  ArticleStatus,
  ArticleEditorialPersistPlan,
} from "./article-adapter";

export {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  isEventStatus,
  hasPendingEventReturn,
  eventActorCapabilities,
  canTransitionEventStatus,
  targetEventStatusForAction,
  canPerformEventEditorialAction,
  availableEventEditorialActions,
  expectedEventActionHint,
  planEventEditorialPersist,
  eventPrismaDataFromPlan,
  validateEventForPublish,
  initialEventStatusForOrigin,
  mapLegacyEventStatus,
  eventDenialReason,
} from "./event-adapter";

export type {
  EventStatus,
  EventEditorialPersistPlan,
} from "./event-adapter";
