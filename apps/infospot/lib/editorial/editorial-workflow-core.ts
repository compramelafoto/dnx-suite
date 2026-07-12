import { EDITORIAL_STATUS_LABELS } from "./editorial-status";
import { EDITORIAL_ACTIONS } from "./types";
import type {
  EditorialAction,
  EditorialDenialCode,
  EditorialPermissionResult,
  EditorialStatus,
  EditorialTransitionContext,
  EditorialTransitionResolution,
} from "./types";

/**
 * Transición genérica (sin rol). Usar `canPerformEditorialTransition` para permisos.
 * Conserva compatibilidad con publish desde DRAFT / UNPUBLISHED / IN_REVIEW.
 */
export function canTransitionEditorialStatus(
  from: EditorialStatus,
  to: EditorialStatus,
): boolean {
  if (from === to) return true;
  if (to === "ARCHIVED") return from !== "ARCHIVED";
  if (to === "IN_REVIEW") return from === "DRAFT";
  if (to === "DRAFT") return from === "IN_REVIEW";
  if (to === "READY_TO_PUBLISH") return from === "IN_REVIEW" || from === "DRAFT";
  if (to === "PUBLISHED") {
    return (
      from === "READY_TO_PUBLISH" ||
      from === "DRAFT" ||
      from === "UNPUBLISHED" ||
      from === "IN_REVIEW"
    );
  }
  if (to === "UNPUBLISHED") return from === "PUBLISHED";
  return false;
}

/** Destino nominal de una acción (sin considerar permisos del actor). */
export function targetStatusForEditorialAction(action: EditorialAction): EditorialStatus {
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

/**
 * Destino efectivo: si el actor no puede publicar y pide PUBLISH desde DRAFT,
 * el flujo real es enviar a revisión (IN_REVIEW).
 */
export function resolveEffectiveEditorialTarget(
  from: EditorialStatus,
  action: EditorialAction,
  actor: { canPublish: boolean },
): { targetStatus: EditorialStatus; via: "direct" | "submit_via_publish" } {
  if (action === "PUBLISH" && !actor.canPublish) {
    return { targetStatus: "IN_REVIEW", via: "submit_via_publish" };
  }
  void from;
  return {
    targetStatus: targetStatusForEditorialAction(action),
    via: "direct",
  };
}

export function canPerformEditorialTransition(
  ctx: EditorialTransitionContext,
): EditorialPermissionResult {
  const { from, action, actor } = ctx;
  void ctx.meta;
  void ctx.contentType;

  if (!actor) {
    return { ok: false, code: "NO_SESSION" };
  }

  const { canPublish, isDirector } = actor;
  const to = targetStatusForEditorialAction(action);

  // Misma guarda que el legacy: valida transición al destino nominal de la acción.
  // PUBLISH sin permiso desde DRAFT: canTransition(DRAFT→PUBLISHED) es true,
  // y luego el switch permite la acción (que el adaptador ejecuta como IN_REVIEW).
  if (!canTransitionEditorialStatus(from, to) && !(from === to)) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }

  switch (action) {
    case "SUBMIT_REVIEW": {
      if (from !== "DRAFT") {
        return { ok: false, code: "SUBMIT_NOT_DRAFT" };
      }
      return { ok: true };
    }
    case "RETURN": {
      if (!isDirector) {
        return { ok: false, code: "RETURN_NOT_DIRECTOR" };
      }
      if (from !== "IN_REVIEW") {
        return { ok: false, code: "RETURN_NOT_IN_REVIEW" };
      }
      return { ok: true };
    }
    case "APPROVE": {
      if (!isDirector && !canPublish) {
        return { ok: false, code: "APPROVE_NO_PERMISSION" };
      }
      if (from !== "IN_REVIEW" && !(isDirector && from === "DRAFT")) {
        return { ok: false, code: "APPROVE_WRONG_STATUS" };
      }
      if (!isDirector && from !== "IN_REVIEW") {
        return { ok: false, code: "APPROVE_DRAFT_NOT_DIRECTOR" };
      }
      return { ok: true };
    }
    case "PUBLISH": {
      if (!canPublish) {
        if (from !== "DRAFT") {
          return { ok: false, code: "PUBLISH_REQUIRES_DRAFT" };
        }
        return { ok: true };
      }
      if (
        from !== "READY_TO_PUBLISH" &&
        from !== "UNPUBLISHED" &&
        !(canPublish && (from === "DRAFT" || from === "IN_REVIEW"))
      ) {
        return { ok: false, code: "PUBLISH_NOT_PUBLISHABLE" };
      }
      return { ok: true };
    }
    case "UNPUBLISH": {
      if (!canPublish) {
        return { ok: false, code: "UNPUBLISH_NO_PERMISSION" };
      }
      if (from !== "PUBLISHED") {
        return { ok: false, code: "UNPUBLISH_NOT_PUBLISHED" };
      }
      return { ok: true };
    }
    case "ARCHIVE": {
      if (from === "ARCHIVED") {
        return { ok: false, code: "ALREADY_ARCHIVED" };
      }
      return { ok: true };
    }
    default:
      return { ok: false, code: "UNKNOWN_ACTION" };
  }
}

/**
 * Resuelve permiso + destino efectivo en un solo paso.
 */
export function resolveEditorialTransition(
  ctx: EditorialTransitionContext,
): EditorialTransitionResolution {
  const permission = canPerformEditorialTransition(ctx);
  if (!permission.ok) {
    return permission;
  }
  const { targetStatus, via } = resolveEffectiveEditorialTarget(
    ctx.from,
    ctx.action,
    ctx.actor,
  );
  return { ok: true, targetStatus, via };
}

export function availableEditorialActionsFor(
  ctx: Omit<EditorialTransitionContext, "action">,
): EditorialAction[] {
  return EDITORIAL_ACTIONS.filter(
    (action) => canPerformEditorialTransition({ ...ctx, action }).ok,
  );
}

/** Texto de acción esperada para listados / colas. */
export function expectedEditorialActionHint(
  status: EditorialStatus,
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

/**
 * Mensaje humano para INVALID_TRANSITION (usa labels genéricos del núcleo).
 * Los adaptadores pueden sustituir por copy de producto.
 */
export function formatInvalidTransitionReason(
  from: EditorialStatus,
  to: EditorialStatus,
  labels: Record<EditorialStatus, string> = EDITORIAL_STATUS_LABELS,
): string {
  return `No se puede pasar de ${labels[from]} a ${labels[to]}.`;
}

export function isEditorialDenialCode(value: string): value is EditorialDenialCode {
  return (
    value === "NO_SESSION" ||
    value === "INVALID_TRANSITION" ||
    value === "SUBMIT_NOT_DRAFT" ||
    value === "RETURN_NOT_DIRECTOR" ||
    value === "RETURN_NOT_IN_REVIEW" ||
    value === "APPROVE_NO_PERMISSION" ||
    value === "APPROVE_WRONG_STATUS" ||
    value === "APPROVE_DRAFT_NOT_DIRECTOR" ||
    value === "PUBLISH_REQUIRES_DRAFT" ||
    value === "PUBLISH_NOT_PUBLISHABLE" ||
    value === "UNPUBLISH_NO_PERMISSION" ||
    value === "UNPUBLISH_NOT_PUBLISHED" ||
    value === "ALREADY_ARCHIVED" ||
    value === "UNKNOWN_ACTION"
  );
}
