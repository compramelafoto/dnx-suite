import type {
  PartnerBenefitSyncEventPayload,
  PartnerBenefitSyncEventType,
} from "./auto-sync-types";

export function buildPartnerBenefitSyncEventKey(
  payload: PartnerBenefitSyncEventPayload,
): string {
  const v = payload.versionToken?.trim() || payload.occurredAt;
  const t = payload.eventType;
  switch (t) {
    case "CLICKATON_REGISTRATION_CREATED":
    case "CLICKATON_REGISTRATION_CONFIRMED":
    case "CLICKATON_REGISTRATION_CANCELLED":
    case "CLICKATON_REGISTRATION_USER_LINKED":
      return `${slug(t)}:${payload.registrationId ?? "x"}:${v}`;
    case "CLICKATON_REGISTRATION_CATEGORY_CHANGED":
      return `${slug(t)}:${payload.registrationId ?? "x"}:${payload.categoryId ?? "x"}:${payload.previousCategoryId ?? "x"}:${v}`;
    case "CLICKATON_PAYMENT_CONFIRMED":
    case "CLICKATON_PAYMENT_REVERSED":
      return `${slug(t)}:${payload.registrationId ?? "x"}:${payload.paymentOrderId ?? "x"}:${v}`;
    case "CLICKATON_WINNER_CONFIRMED":
    case "CLICKATON_WINNER_REVOKED":
      return `${slug(t)}:${payload.prizeAssignmentId ?? "x"}:${v}`;
    case "PARTNER_BENEFIT_ACTIVATED":
    case "PARTNER_BENEFIT_PAUSED":
    case "PARTNER_BENEFIT_ARCHIVED":
    case "PARTNER_BENEFIT_AUDIENCE_CHANGED":
    case "PARTNER_BENEFIT_VALIDITY_CHANGED":
      return `${slug(t)}:${payload.benefitId ?? "x"}:${v}`;
    default: {
      const _exhaustive: never = t;
      return `unknown:${String(_exhaustive)}:${v}`;
    }
  }
}

function slug(t: PartnerBenefitSyncEventType): string {
  return t
    .toLowerCase()
    .replace(/^clickaton_/, "")
    .replace(/^partner_/, "")
    .replace(/_/g, "-");
}
