import type { ReviewStatus } from "./constants";
import { can, type ActivityRole, type Capability } from "./team";

/**
 * Quién puede hacer qué con una actividad.
 *
 * Etapa 1: revisa sólo el super admin de la suite (Daniel). En la etapa 2 se suma la
 * institución del socio (`workspaceId`) como revisora de lo suyo; por eso el dato ya viaja.
 */
export type ReviewAction = "submit" | "approve" | "reject" | "unpublish" | "republish" | "cancel" | "uncancel";
/**
 * `role`: el rol de la persona en esta muestra (etapa 5). Sin `role` (código viejo y tests), se
 * deduce: dueño o nada.
 */
export type Actor = { userId: number; isSuperAdmin: boolean; role?: ActivityRole | null };
export type ActivityForReview = {
  reviewStatus: ReviewStatus;
  proposedByUserId: number;
  workspaceId: string | null;
  isCancelled: boolean;
};
export type Permission = { ok: true } | { ok: false; reason: string };

const TRANSITIONS: Record<ReviewAction, Partial<Record<ReviewStatus, ReviewStatus>>> = {
  submit: { DRAFT: "IN_REVIEW", REJECTED: "IN_REVIEW" },
  approve: { IN_REVIEW: "APPROVED" },
  reject: { IN_REVIEW: "REJECTED" },
  unpublish: { APPROVED: "UNPUBLISHED" },
  republish: { UNPUBLISHED: "APPROVED" },
  cancel: { APPROVED: "APPROVED" },
  uncancel: { APPROVED: "APPROVED" },
};

export function nextStatus(action: ReviewAction, current: ReviewStatus): ReviewStatus {
  const next = TRANSITIONS[action][current];
  if (!next) throw new Error(`No se puede "${action}" una actividad en estado ${current}.`);
  return next;
}

function isReviewer(_a: ActivityForReview, actor: Actor): boolean {
  return actor.isSuperAdmin;
}
function puede(cap: Capability, a: ActivityForReview, actor: Actor): boolean {
  const role = actor.role !== undefined ? actor.role : a.proposedByUserId === actor.userId ? "OWNER" : null;
  return can(cap, { role, isSuperAdmin: actor.isSuperAdmin });
}

export function canPerform(action: ReviewAction, a: ActivityForReview, actor: Actor): Permission {
  if (!TRANSITIONS[action][a.reviewStatus]) {
    return { ok: false, reason: "La actividad no está en un estado que permita esta acción." };
  }
  switch (action) {
    case "submit":
      if (puede("submitForReview", a, actor)) return { ok: true };
      // A quien es del equipo pero su rol no envía, no se le dice "sólo quien la propuso" (la coorganización también puede).
      return { ok: false, reason: actor.role ? "Tu rol en esta muestra no permite enviarla a revisión." : "Sólo quien la propuso puede enviarla." };
    case "approve":
    case "reject":
    case "unpublish":
    case "republish":
      return isReviewer(a, actor) ? { ok: true } : { ok: false, reason: "No tenés permiso para revisar esta actividad." };
    case "cancel":
      if (a.isCancelled) return { ok: false, reason: "Ya está cancelada." };
      return puede("cancel", a, actor) ? { ok: true } : { ok: false, reason: "No podés cancelar esta actividad." };
    case "uncancel":
      if (!a.isCancelled) return { ok: false, reason: "No está cancelada." };
      return puede("cancel", a, actor) ? { ok: true } : { ok: false, reason: "No podés reactivar esta actividad." };
  }
}

/** Se edita en borrador, rechazada y publicada (sin volver a revisión). No en revisión. */
export function canEdit(a: ActivityForReview, actor: Actor): boolean {
  if (isReviewer(a, actor)) return true;
  if (!puede("editActivity", a, actor)) return false;
  return a.reviewStatus === "DRAFT" || a.reviewStatus === "REJECTED" || a.reviewStatus === "APPROVED";
}

/** Textos (etapa 5, D9): mismos estados que la ficha, con la capacidad `editTexts`. */
export function canEditTexts(a: ActivityForReview, actor: Actor): boolean {
  if (isReviewer(a, actor)) return true;
  if (!puede("editTexts", a, actor)) return false;
  return a.reviewStatus === "DRAFT" || a.reviewStatus === "REJECTED" || a.reviewStatus === "APPROVED";
}
