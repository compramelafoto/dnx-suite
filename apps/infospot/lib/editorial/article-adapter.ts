/**
 * Adaptador editorial para InfoSpotArticle.
 *
 * Mapea permisos de Article → capacidades del núcleo, conserva copy de producto
 * (labels en femenino, razones con “nota”) y construye el plan de persistencia.
 * No toca Prisma: la server action aplica el plan.
 */

import type { InfoSpotPermissionSubject } from "@repo/db";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotArticle,
} from "@repo/db";
import {
  EDITORIAL_STATUSES,
  isEditorialStatus,
} from "./editorial-status";
import {
  availableEditorialActionsFor,
  canPerformEditorialTransition,
  canTransitionEditorialStatus,
  expectedEditorialActionHint,
  formatInvalidTransitionReason,
  resolveEditorialTransition,
  resolveEffectiveEditorialTarget,
  targetStatusForEditorialAction,
} from "./editorial-workflow-core";
import type {
  EditorialAction,
  EditorialActorCapabilities,
  EditorialDenialCode,
  EditorialStatus,
  EditorialTransitionContext,
} from "./types";

/** Alias de dominio Article ≡ estados editoriales compartidos. */
export type ArticleStatus = EditorialStatus;

export const ARTICLE_STATUSES = EDITORIAL_STATUSES;

/** Labels de producto actuales (femenino: “Publicada”, “Lista para publicar”). */
export const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  READY_TO_PUBLISH: "Lista para publicar",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "Despublicada",
  ARCHIVED: "Archivada",
};

export type { EditorialAction };

/** Reexport con el nombre histórico usado por UI. */
export { EDITORIAL_ACTION_LABELS } from "./editorial-status";

export function isArticleStatus(value: string): value is ArticleStatus {
  return isEditorialStatus(value);
}

/** Capacidades del actor para el contenido ARTICLE. */
export function articleActorCapabilities(
  subject: InfoSpotPermissionSubject | null | undefined,
): EditorialActorCapabilities | null {
  if (!subject) return null;
  return {
    canPublish: canPublishInfoSpotArticle(subject),
    isDirector: canManageInfoSpotSettings(subject),
  };
}

export function hasPendingReturn(article: {
  status: string;
  returnedAt?: Date | string | null;
  submittedForReviewAt?: Date | string | null;
}): boolean {
  if (article.status !== "DRAFT") return false;
  if (!article.returnedAt) return false;
  if (!article.submittedForReviewAt) return true;
  return (
    new Date(article.returnedAt).getTime() >=
    new Date(article.submittedForReviewAt).getTime()
  );
}

/** Copy exacto del workflow de artículos (no cambiar: UI / errores visibles). */
const ARTICLE_DENIAL_REASONS: Record<EditorialDenialCode, string> = {
  NO_SESSION: "Sin sesión editorial.",
  INVALID_TRANSITION: "", // se completa con from/to
  SUBMIT_NOT_DRAFT: "Solo se envían a revisión los borradores.",
  RETURN_NOT_DIRECTOR: "Solo el Director puede devolver una nota.",
  RETURN_NOT_IN_REVIEW: "Solo se pueden devolver notas en revisión.",
  APPROVE_NO_PERMISSION: "No tenés permiso para aprobar.",
  APPROVE_WRONG_STATUS:
    "Solo se aprueban notas en revisión (o borradores, si sos Director).",
  APPROVE_DRAFT_NOT_DIRECTOR: "Solo el Director puede aprobar desde borrador.",
  PUBLISH_REQUIRES_DRAFT: "Solo podés pedir publicación desde un borrador.",
  PUBLISH_NOT_PUBLISHABLE: "La nota no está en un estado publicable.",
  UNPUBLISH_NO_PERMISSION: "No tenés permiso para despublicar.",
  UNPUBLISH_NOT_PUBLISHED: "Solo se despublican notas publicadas.",
  ALREADY_ARCHIVED: "La nota ya está archivada.",
  UNKNOWN_ACTION: "Acción no reconocida.",
};

export function articleDenialReason(
  code: EditorialDenialCode,
  from?: ArticleStatus,
  to?: ArticleStatus,
): string {
  if (code === "INVALID_TRANSITION" && from && to) {
    return formatInvalidTransitionReason(from, to, STATUS_LABELS);
  }
  return ARTICLE_DENIAL_REASONS[code];
}

function buildArticleContext(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  action: EditorialAction,
  article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): EditorialTransitionContext | null {
  const actor = articleActorCapabilities(subject);
  if (!actor) return null;
  return {
    contentType: "ARTICLE",
    from,
    action,
    actor,
    meta: article
      ? {
          returnedAt: article.returnedAt,
          submittedForReviewAt: article.submittedForReviewAt,
        }
      : undefined,
  };
}

/**
 * Transición genérica (sin rol). Compat: mismo contrato que el legacy.
 */
export function canTransitionStatus(from: ArticleStatus, to: ArticleStatus): boolean {
  return canTransitionEditorialStatus(from, to);
}

export function targetStatusForAction(action: EditorialAction): ArticleStatus {
  return targetStatusForEditorialAction(action);
}

export function canPerformEditorialAction(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  action: EditorialAction,
  article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): { ok: true } | { ok: false; reason: string } {
  const ctx = buildArticleContext(subject, from, action, article);
  if (!ctx) {
    return { ok: false, reason: ARTICLE_DENIAL_REASONS.NO_SESSION };
  }
  const result = canPerformEditorialTransition(ctx);
  if (!result.ok) {
    return {
      ok: false,
      reason: articleDenialReason(
        result.code,
        from,
        targetStatusForEditorialAction(action),
      ),
    };
  }
  return { ok: true };
}

export function availableEditorialActions(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): EditorialAction[] {
  const actor = articleActorCapabilities(subject);
  if (!actor) return [];
  return availableEditorialActionsFor({
    contentType: "ARTICLE",
    from,
    actor,
    meta: article
      ? {
          returnedAt: article.returnedAt,
          submittedForReviewAt: article.submittedForReviewAt,
        }
      : undefined,
  });
}

export function expectedActionHint(
  status: ArticleStatus,
  opts?: { pendingReturn?: boolean; isDirector?: boolean; canPublish?: boolean },
): string {
  return expectedEditorialActionHint(status, opts);
}

/**
 * Plan de persistencia para Article (sin Prisma).
 * La server action aplica timestamps / observaciones / notificaciones.
 */
export type ArticleEditorialPersistPlan =
  | {
      kind: "return";
      status: "DRAFT";
      requiresObservation: true;
    }
  | {
      kind: "submit_via_publish";
      status: "IN_REVIEW";
      setSubmittedForReview: true;
      setContentTagReal: true;
    }
  | {
      kind: "standard";
      status: ArticleStatus;
      setSubmittedForReview?: boolean;
      setApproved?: boolean;
      setPublished?: boolean;
      setUnpublished?: boolean;
      setArchived?: boolean;
      setContentTagReal?: boolean;
      preservePublishedAt?: boolean;
    };

export function planArticleEditorialPersist(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: ArticleStatus,
  action: EditorialAction,
  article?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
):
  | { ok: false; reason: string }
  | { ok: true; plan: ArticleEditorialPersistPlan } {
  const ctx = buildArticleContext(subject, from, action, article);
  if (!ctx) {
    return { ok: false, reason: ARTICLE_DENIAL_REASONS.NO_SESSION };
  }

  const resolution = resolveEditorialTransition(ctx);
  if (!resolution.ok) {
    return {
      ok: false,
      reason: articleDenialReason(
        resolution.code,
        from,
        targetStatusForEditorialAction(action),
      ),
    };
  }

  if (action === "RETURN") {
    return {
      ok: true,
      plan: {
        kind: "return",
        status: "DRAFT",
        requiresObservation: true,
      },
    };
  }

  if (resolution.via === "submit_via_publish") {
    return {
      ok: true,
      plan: {
        kind: "submit_via_publish",
        status: "IN_REVIEW",
        setSubmittedForReview: true,
        setContentTagReal: true,
      },
    };
  }

  const { targetStatus } = resolveEffectiveEditorialTarget(from, action, ctx.actor);

  switch (action) {
    case "SUBMIT_REVIEW":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "IN_REVIEW",
          setSubmittedForReview: true,
          setContentTagReal: true,
        },
      };
    case "APPROVE":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "READY_TO_PUBLISH",
          setApproved: true,
          setContentTagReal: true,
        },
      };
    case "PUBLISH":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "PUBLISHED",
          setPublished: true,
          setContentTagReal: true,
          preservePublishedAt: true,
        },
      };
    case "UNPUBLISH":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "UNPUBLISHED",
          setUnpublished: true,
        },
      };
    case "ARCHIVE":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "ARCHIVED",
          setArchived: true,
        },
      };
    default:
      return {
        ok: true,
        plan: { kind: "standard", status: targetStatus },
      };
  }
}

/** Construye el objeto `data` de update de Prisma a partir del plan standard. */
export function articlePrismaDataFromPlan(
  plan: Extract<ArticleEditorialPersistPlan, { kind: "standard" | "submit_via_publish" }>,
  opts: {
    now: Date;
    userId: number;
    publishedAt?: Date | string | null;
  },
): Record<string, unknown> {
  const data: Record<string, unknown> = { status: plan.status };

  if (plan.kind === "submit_via_publish" || plan.setSubmittedForReview) {
    data.submittedForReviewAt = opts.now;
    data.submittedForReviewByUserId = opts.userId;
  }
  if (plan.kind === "submit_via_publish" || plan.setContentTagReal) {
    data.contentTag = "REAL";
  }
  if (plan.kind === "standard") {
    if (plan.setApproved) {
      data.approvedAt = opts.now;
      data.approvedByUserId = opts.userId;
    }
    if (plan.setPublished) {
      data.publishedAt = opts.publishedAt ?? opts.now;
      data.publishedByUserId = opts.userId;
    }
    if (plan.setUnpublished) {
      data.unpublishedAt = opts.now;
      data.unpublishedByUserId = opts.userId;
    }
    if (plan.setArchived) {
      data.archivedAt = opts.now;
      data.archivedByUserId = opts.userId;
    }
  }
  return data;
}
