import type {
  DnxPartnerOnboardingAdminStatus,
  OnboardingInvitationRecord,
} from "./onboarding-types";

/**
 * Resuelve columna admin "Datos del Partner" a partir de invitaciones.
 * Independiente de status comercial (PROSPECT / ACTIVE).
 */
export function resolveOnboardingAdminStatus(
  invitations: readonly Pick<
    OnboardingInvitationRecord,
    "status" | "reviewStatus" | "expiresAt"
  >[],
  now = new Date(),
): DnxPartnerOnboardingAdminStatus {
  if (!invitations.length) return "NOT_REQUESTED";

  const live = invitations.filter((i) => i.status !== "REVOKED");
  if (!live.length) return "NOT_REQUESTED";

  const approved = live.find(
    (i) => i.status === "SUBMITTED" && i.reviewStatus === "APPROVED",
  );
  if (approved) return "COMPLETE";

  const pendingReview = live.find(
    (i) =>
      i.status === "SUBMITTED" &&
      (i.reviewStatus === "PENDING_REVIEW" ||
        i.reviewStatus === "CHANGES_REQUESTED"),
  );
  if (pendingReview) {
    return pendingReview.reviewStatus === "PENDING_REVIEW"
      ? "PENDING_REVIEW"
      : "DATA_RECEIVED";
  }

  const submitted = live.find((i) => i.status === "SUBMITTED");
  if (submitted) return "DATA_RECEIVED";

  const opened = live.find((i) => i.status === "OPENED");
  if (opened) {
    if (opened.expiresAt.getTime() < now.getTime()) return "EXPIRED";
    return "OPENED";
  }

  const pending = live.find((i) => i.status === "PENDING");
  if (pending) {
    if (pending.expiresAt.getTime() < now.getTime()) return "EXPIRED";
    return "INVITATION_SENT";
  }

  const expired = live.find(
    (i) =>
      i.status === "EXPIRED" ||
      (i.status !== "SUBMITTED" && i.expiresAt.getTime() < now.getTime()),
  );
  if (expired) return "EXPIRED";

  return "NOT_REQUESTED";
}
