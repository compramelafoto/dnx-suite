/**
 * Adaptador editorial para InfoSpotEvent.
 *
 * Copy de producto ("evento"), permisos, plan de persistencia y checklist.
 * La lógica pura de transiciones vive en `editorial-workflow-core.ts`.
 *
 * ETAPA 15: READY_TO_PUBLISH oculto en UX; APPROVE alias de PUBLISH → PUBLISHED.
 * contentTag ya no se fuerza en operaciones editoriales.
 */

import type { InfoSpotPermissionSubject } from "@repo/db";
import {
  canManageInfoSpotSettings,
  canPublishInfoSpotEvent,
} from "@repo/db";
import {
  EDITORIAL_ACTION_LABELS,
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
import {
  buildEventPublishChecklist,
  checklistWarnings,
} from "../launch-content";

export type EventStatus = EditorialStatus;

export const EVENT_STATUSES = EDITORIAL_STATUSES;

/** Labels de producto para eventos. READY_TO_PUBLISH = "En revisión". */
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  READY_TO_PUBLISH: "En revisión",
  PUBLISHED: "Publicado",
  UNPUBLISHED: "Despublicado",
  ARCHIVED: "Archivado",
};

export type { EditorialAction };
export { EDITORIAL_ACTION_LABELS };

export function isEventStatus(value: string): value is EventStatus {
  return isEditorialStatus(value);
}

export function eventActorCapabilities(
  subject: InfoSpotPermissionSubject | null | undefined,
): EditorialActorCapabilities | null {
  if (!subject) return null;
  return {
    canPublish: canPublishInfoSpotEvent(subject),
    isDirector: canManageInfoSpotSettings(subject),
  };
}

export function hasPendingEventReturn(event: {
  status: string;
  returnedAt?: Date | string | null;
  submittedForReviewAt?: Date | string | null;
}): boolean {
  if (event.status !== "DRAFT") return false;
  if (!event.returnedAt) return false;
  if (!event.submittedForReviewAt) return true;
  return (
    new Date(event.returnedAt).getTime() >=
    new Date(event.submittedForReviewAt).getTime()
  );
}

const EVENT_DENIAL_REASONS: Record<EditorialDenialCode, string> = {
  NO_SESSION: "Sin sesión editorial.",
  INVALID_TRANSITION: "",
  SUBMIT_NOT_DRAFT: "Solo se envían a revisión los borradores.",
  RETURN_NOT_DIRECTOR: "Solo el Director o quien puede publicar puede devolver un evento.",
  RETURN_NOT_IN_REVIEW: "Solo se pueden devolver eventos en revisión.",
  APPROVE_NO_PERMISSION: "No tenés permiso para publicar.",
  APPROVE_WRONG_STATUS: "Solo se publican eventos en revisión (o borradores, si sos Director).",
  APPROVE_DRAFT_NOT_DIRECTOR: "Solo el Director puede publicar desde borrador.",
  PUBLISH_REQUIRES_DRAFT: "Solo podés pedir publicación desde un borrador.",
  PUBLISH_NOT_PUBLISHABLE: "El evento no está en un estado publicable.",
  UNPUBLISH_NO_PERMISSION: "No tenés permiso para despublicar.",
  UNPUBLISH_NOT_PUBLISHED: "Solo se despublican eventos publicados.",
  ALREADY_ARCHIVED: "El evento ya está archivado.",
  UNKNOWN_ACTION: "Acción no reconocida.",
};

export function eventDenialReason(
  code: EditorialDenialCode,
  from?: EventStatus,
  to?: EventStatus,
): string {
  if (code === "INVALID_TRANSITION" && from && to) {
    return formatInvalidTransitionReason(from, to, EVENT_STATUS_LABELS);
  }
  return EVENT_DENIAL_REASONS[code];
}

function buildEventContext(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: EventStatus,
  action: EditorialAction,
  event?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): EditorialTransitionContext | null {
  const actor = eventActorCapabilities(subject);
  if (!actor) return null;
  return {
    contentType: "EVENT",
    from,
    action,
    actor,
    meta: event
      ? {
          returnedAt: event.returnedAt,
          submittedForReviewAt: event.submittedForReviewAt,
        }
      : undefined,
  };
}

export function canTransitionEventStatus(from: EventStatus, to: EventStatus): boolean {
  return canTransitionEditorialStatus(from, to);
}

export function targetEventStatusForAction(action: EditorialAction): EventStatus {
  return targetStatusForEditorialAction(action);
}

export function canPerformEventEditorialAction(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: EventStatus,
  action: EditorialAction,
  event?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): { ok: true } | { ok: false; reason: string } {
  const ctx = buildEventContext(subject, from, action, event);
  if (!ctx) {
    return { ok: false, reason: EVENT_DENIAL_REASONS.NO_SESSION };
  }
  const result = canPerformEditorialTransition(ctx);
  if (!result.ok) {
    return {
      ok: false,
      reason: eventDenialReason(result.code, from, targetStatusForEditorialAction(action)),
    };
  }
  return { ok: true };
}

export function availableEventEditorialActions(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: EventStatus,
  event?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
): EditorialAction[] {
  const actor = eventActorCapabilities(subject);
  if (!actor) return [];
  return availableEditorialActionsFor({
    contentType: "EVENT",
    from,
    actor,
    meta: event
      ? {
          returnedAt: event.returnedAt,
          submittedForReviewAt: event.submittedForReviewAt,
        }
      : undefined,
  });
}

export function expectedEventActionHint(
  status: EventStatus,
  opts?: { pendingReturn?: boolean; isDirector?: boolean; canPublish?: boolean },
): string {
  return expectedEditorialActionHint(status, opts);
}

export type EventEditorialPersistPlan =
  | {
      kind: "return";
      status: "DRAFT";
      requiresObservation: true;
    }
  | {
      kind: "submit_via_publish";
      status: "IN_REVIEW";
      setSubmittedForReview: true;
    }
  | {
      kind: "standard";
      status: EventStatus;
      setSubmittedForReview?: boolean;
      setApproved?: boolean;
      setPublished?: boolean;
      setUnpublished?: boolean;
      setArchived?: boolean;
      preservePublishedAt?: boolean;
    };

export function planEventEditorialPersist(
  subject: InfoSpotPermissionSubject | null | undefined,
  from: EventStatus,
  action: EditorialAction,
  event?: {
    returnedAt?: Date | string | null;
    submittedForReviewAt?: Date | string | null;
  },
):
  | { ok: false; reason: string }
  | { ok: true; plan: EventEditorialPersistPlan } {
  const ctx = buildEventContext(subject, from, action, event);
  if (!ctx) {
    return { ok: false, reason: EVENT_DENIAL_REASONS.NO_SESSION };
  }

  const resolution = resolveEditorialTransition(ctx);
  if (!resolution.ok) {
    return {
      ok: false,
      reason: eventDenialReason(
        resolution.code,
        from,
        targetStatusForEditorialAction(action),
      ),
    };
  }

  if (action === "RETURN") {
    return {
      ok: true,
      plan: { kind: "return", status: "DRAFT", requiresObservation: true },
    };
  }

  if (resolution.via === "submit_via_publish") {
    return {
      ok: true,
      plan: {
        kind: "submit_via_publish",
        status: "IN_REVIEW",
        setSubmittedForReview: true,
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
        },
      };
    case "APPROVE":
      // Legacy alias → PUBLISHED directo
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "PUBLISHED",
          setApproved: true,
          setPublished: true,
          preservePublishedAt: true,
        },
      };
    case "PUBLISH":
      return {
        ok: true,
        plan: {
          kind: "standard",
          status: "PUBLISHED",
          setPublished: true,
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
      return { ok: true, plan: { kind: "standard", status: targetStatus } };
  }
}

export function eventPrismaDataFromPlan(
  plan: Extract<EventEditorialPersistPlan, { kind: "standard" | "submit_via_publish" }>,
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
    data.submittedByUserId = opts.userId;
  }
  if (plan.kind === "standard") {
    if (plan.setApproved) {
      data.approvedAt = opts.now;
      data.approvedByUserId = opts.userId;
      data.reviewedByUserId = opts.userId;
    }
    if (plan.setPublished) {
      data.publishedAt = opts.publishedAt ?? opts.now;
      data.publishedByUserId = opts.userId;
      data.reviewedByUserId = opts.userId;
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

/** Validación previa a PUBLISH (checklist de eventos). No fuerza contentTag. */
export function validateEventForPublish(event: {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  organizerName?: string | null;
  startAt?: Date | string | null;
  city?: string | null;
  province?: string | null;
  slug?: string | null;
  contentTag?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationConfirmedAt?: Date | string | null;
  geocodingStatus?: string | null;
}): string | null {
  const items = buildEventPublishChecklist({
    title: event.title,
    summary: event.summary,
    description: event.description,
    categoryId: event.categoryId,
    coverImageUrl: event.coverImageUrl,
    organizerName: event.organizerName,
    startAt: event.startAt,
    city: event.city,
    province: event.province,
    slug: event.slug,
    // contentTag no bloquea publicación (ETAPA 15)
    contentTag: event.contentTag as "DEMO" | "REAL" | "NEEDS_REVIEW" | null | undefined,
    latitude: event.latitude,
    longitude: event.longitude,
    locationConfirmedAt: event.locationConfirmedAt,
    geocodingStatus: event.geocodingStatus,
  });
  const missing = checklistWarnings(items);
  if (missing.length === 0) return null;
  return `Faltan: ${missing.join(", ")}.`;
}

/** Estado inicial según origen (sin persistir). */
export function initialEventStatusForOrigin(
  origin: "REDACCION" | "PUBLIC_INTAKE" | "CLF_IMPORT_FUTURE",
): EventStatus {
  if (origin === "PUBLIC_INTAKE") return "IN_REVIEW";
  return "DRAFT";
}

/** Mapeo documentado de estados legacy (tests / docs). */
export function mapLegacyEventStatus(legacy: string): EventStatus {
  switch (legacy) {
    case "PENDING_REVIEW":
      return "IN_REVIEW";
    case "REJECTED":
      return "DRAFT";
    case "READY_TO_PUBLISH":
      // ETAPA 15: tratamos READY_TO_PUBLISH como IN_REVIEW
      return "IN_REVIEW";
    case "DRAFT":
    case "IN_REVIEW":
    case "PUBLISHED":
    case "UNPUBLISHED":
    case "ARCHIVED":
      return legacy;
    default:
      return "DRAFT";
  }
}
