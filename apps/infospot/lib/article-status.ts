import type { InfoSpotPermissionSubject } from "@repo/db";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
} from "@repo/db";

export const ARTICLE_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "UNPUBLISHED",
  "ARCHIVED",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  READY_TO_PUBLISH: "Lista para publicar",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "Despublicada",
  ARCHIVED: "Archivada",
};

/** Acción editorial explícita (no status crudo del cliente). */
export type EditorialAction =
  | "SUBMIT_REVIEW"
  | "RETURN"
  | "APPROVE"
  | "PUBLISH"
  | "UNPUBLISH"
  | "ARCHIVE";

export const EDITORIAL_ACTION_LABELS: Record<EditorialAction, string> = {
  SUBMIT_REVIEW: "Enviar a revisión",
  RETURN: "Devolver con observación",
  APPROVE: "Aprobar para publicar",
  PUBLISH: "Publicar",
  UNPUBLISH: "Despublicar",
  ARCHIVE: "Archivar",
};

export function isArticleStatus(value: string): value is ArticleStatus {
  return (ARTICLE_STATUSES as readonly string[]).includes(value);
}

export function hasPendingReturn(article: {
  status: string;
  returnedAt?: Date | string | null;
  submittedForReviewAt?: Date | string | null;
}): boolean {
  if (article.status !== "DRAFT") return false;
  if (!article.returnedAt) return false;
  if (!article.submittedForReviewAt) return true;
  return new Date(article.returnedAt).getTime() >= new Date(article.submittedForReviewAt).getTime();
}

/**
 * Transición genérica (sin rol). Usar `canPerformEditorialAction` para permisos.
 * Conserva compatibilidad con llamadas legacy (publish desde DRAFT / UNPUBLISHED).
 */
export function canTransitionStatus(from: ArticleStatus, to: ArticleStatus): boolean {
  if (from === to) return true;
  if (to === "ARCHIVED") return from !== "ARCHIVED";
  if (to === "IN_REVIEW") return from === "DRAFT";
  if (to === "DRAFT") return from === "IN_REVIEW";
  if (to === "READY_TO_PUBLISH") return from === "IN_REVIEW" || from === "DRAFT";
  if (to === "PUBLISHED") {
    return from === "READY_TO_PUBLISH" || from === "DRAFT" || from === "UNPUBLISHED" || from === "IN_REVIEW";
  }
  if (to === "UNPUBLISHED") return from === "PUBLISHED";
  return false;
}

export function targetStatusForAction(action: EditorialAction): ArticleStatus {
  switch (action) {
    case "SUBMIT_REVIEW":
      return "IN_REVIEW";
    case "RETURN":
      return "DRAFT";
    case "APPROVE":
      return "READY_TO_PUBLISH";
    case "PUBLISH":
      return "PUBLISHED";
    case "UNPUBLISH":
      return "UNPUBLISHED";
    case "ARCHIVE":
      return "ARCHIVED";
  }
}

export function canPerformEditorialAction(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  action: EditorialAction,
  _article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): { ok: true } | { ok: false; reason: string } {
  if (!subject) {
    return { ok: false, reason: "Sin sesión editorial." };
  }
  void _article;

  const isDirector = canManageInfoSpotSettings(subject);
  const canPublish = canPublishInfoSpotArticle(subject);
  const to = targetStatusForAction(action);

  if (!canTransitionStatus(from, to) && !(from === to)) {
    return {
      ok: false,
      reason: `No se puede pasar de ${STATUS_LABELS[from]} a ${STATUS_LABELS[to]}.`,
    };
  }

  switch (action) {
    case "SUBMIT_REVIEW": {
      if (from !== "DRAFT") {
        return { ok: false, reason: "Solo se envían a revisión los borradores." };
      }
      return { ok: true };
    }
    case "RETURN": {
      if (!isDirector) {
        return { ok: false, reason: "Solo el Director puede devolver una nota." };
      }
      if (from !== "IN_REVIEW") {
        return { ok: false, reason: "Solo se pueden devolver notas en revisión." };
      }
      return { ok: true };
    }
    case "APPROVE": {
      if (!isDirector && !canPublish) {
        return { ok: false, reason: "No tenés permiso para aprobar." };
      }
      // Colaborador nunca: canPublish=false. Redactor canPublish puede aprobar desde IN_REVIEW.
      if (from !== "IN_REVIEW" && !(isDirector && from === "DRAFT")) {
        return {
          ok: false,
          reason: "Solo se aprueban notas en revisión (o borradores, si sos Director).",
        };
      }
      if (!isDirector && from !== "IN_REVIEW") {
        return { ok: false, reason: "Solo el Director puede aprobar desde borrador." };
      }
      return { ok: true };
    }
    case "PUBLISH": {
      // Sin permiso de publicar: "Publicar" = pedir aprobación (DRAFT → IN_REVIEW).
      if (!canPublish) {
        if (from !== "DRAFT") {
          return {
            ok: false,
            reason: "Solo podés pedir publicación desde un borrador.",
          };
        }
        return { ok: true };
      }
      if (
        from !== "READY_TO_PUBLISH" &&
        from !== "UNPUBLISHED" &&
        !(canPublish && (from === "DRAFT" || from === "IN_REVIEW"))
      ) {
        return {
          ok: false,
          reason: "La nota no está en un estado publicable.",
        };
      }
      return { ok: true };
    }
    case "UNPUBLISH": {
      if (!canPublish) {
        return { ok: false, reason: "No tenés permiso para despublicar." };
      }
      if (from !== "PUBLISHED") {
        return { ok: false, reason: "Solo se despublican notas publicadas." };
      }
      return { ok: true };
    }
    case "ARCHIVE": {
      if (from === "ARCHIVED") {
        return { ok: false, reason: "La nota ya está archivada." };
      }
      // Cualquier rol editorial con acceso a redacción puede archivar (política actual).
      return { ok: true };
    }
    default:
      return { ok: false, reason: "Acción no reconocida." };
  }
}

/** Acciones disponibles para UI (solo las permitidas). */
export function availableEditorialActions(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): EditorialAction[] {
  const actions: EditorialAction[] = [
    "SUBMIT_REVIEW",
    "RETURN",
    "APPROVE",
    "PUBLISH",
    "UNPUBLISH",
    "ARCHIVE",
  ];
  return actions.filter((action) => canPerformEditorialAction(subject, from, action, article).ok);
}

/** Texto de acción esperada para listados. */
export function expectedActionHint(
  status: ArticleStatus,
  opts?: { pendingReturn?: boolean; isDirector?: boolean; canPublish?: boolean },
): string {
  if (opts?.pendingReturn) return "Corregir y volver a publicar";
  switch (status) {
    case "DRAFT":
      return opts?.isDirector || opts?.canPublish
        ? "Completar y publicar"
        : "Completar y publicar (queda pendiente de aprobación)";
    case "IN_REVIEW":
      return opts?.isDirector ? "Revisar, devolver o publicar" : "Esperando aprobación del Director";
    case "READY_TO_PUBLISH":
      return "Publicar en el sitio";
    case "PUBLISHED":
      return "Publicada en el sitio";
    case "UNPUBLISHED":
      return "Republicar o archivar";
    case "ARCHIVED":
      return "Archivada";
  }
}
