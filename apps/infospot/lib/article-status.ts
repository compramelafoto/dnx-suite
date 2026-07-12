/**
 * Fachada de compatibilidad del workflow editorial de artículos.
 *
 * La lógica vive en `lib/editorial/` (núcleo genérico + adaptador Article).
 * Los imports existentes desde `@/lib/article-status` siguen funcionando.
 */

export {
  ARTICLE_STATUSES,
  STATUS_LABELS,
  EDITORIAL_ACTION_LABELS,
  isArticleStatus,
  hasPendingReturn,
  canTransitionStatus,
  targetStatusForAction,
  canPerformEditorialAction,
  availableEditorialActions,
  expectedActionHint,
} from "./editorial/article-adapter";

export type { ArticleStatus, EditorialAction } from "./editorial/article-adapter";
