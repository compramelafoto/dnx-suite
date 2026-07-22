import type { PersistedRecipientType } from "../application/persistence/types.js";
import type { DistributionRule } from "../contracts/entities.js";
import type { CurrencyCode, RecipientRole } from "../contracts/primitives.js";
import type {
  AgreementParticipant,
  AgreementParticipantRoleLabel,
  DistributionRuleRecord,
} from "../economic-agreement/types.js";
import type {
  FinancialIdentity,
  PaymentAccount,
} from "../financial-identity/types.js";
import { mapFinancialEnvToPayments } from "../financial-identity/types.js";
import { money } from "../money/index.js";

function roleFromLabel(label: AgreementParticipantRoleLabel): RecipientRole {
  switch (label) {
    case "PLATFORM":
      return "PLATFORM";
    case "PHOTOGRAPHER":
      return "PHOTOGRAPHER";
    case "ORGANIZER":
    case "VENUE_ORGANIZER":
      return "ORGANIZER";
    case "SPONSOR":
      return "SPONSOR";
    default:
      return "OTHER";
  }
}

/** Domain bridge: FinancialIdentity → DnxPaymentRecipient draft (no persistence). */
export function financialIdentityToRecipientDraft(
  identity: FinancialIdentity,
  recipientType: PersistedRecipientType = "OTHER",
): {
  id: string;
  userId: number | undefined;
  recipientType: PersistedRecipientType;
  status: "ACTIVE" | "INACTIVE";
  displayReference: string | undefined;
} {
  return {
    id: `bridge_recipient_${identity.id}`,
    userId: identity.ownerUserId ?? undefined,
    recipientType,
    status: identity.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    displayReference: identity.legalName ?? undefined,
  };
}

/** Domain bridge: PaymentAccount → provider account reference draft. */
export function paymentAccountToProviderAccountDraft(account: PaymentAccount): {
  provider: string;
  environment: "SANDBOX" | "PRODUCTION";
  providerAccountReference: string;
  status: "ACTIVE" | "PENDING" | "REVOKED" | "INACTIVE";
  consentReference: string | null;
} {
  return {
    provider: account.provider,
    environment: mapFinancialEnvToPayments(account.environment),
    providerAccountReference: account.providerUserId ?? account.id,
    status:
      account.status === "ACTIVE"
        ? "ACTIVE"
        : account.status === "REVOKED"
          ? "REVOKED"
          : account.status === "DISABLED"
            ? "INACTIVE"
            : "PENDING",
    consentReference: account.consentReference,
  };
}

/** Domain bridge: DistributionVersion rules → DistributionInput rules. */
export function distributionRulesToEngineInput(
  rules: readonly DistributionRuleRecord[],
  participants: readonly AgreementParticipant[],
  currency: CurrencyCode,
): DistributionRule[] {
  const byId = new Map(participants.map((p) => [p.id, p]));
  return rules.map((rule) => {
    const participant = byId.get(rule.agreementParticipantId);
    if (!participant) {
      throw new Error(`missing participant for rule ${rule.id}`);
    }
    const role = roleFromLabel(participant.roleLabel);
    if (rule.kind === "PERCENTAGE") {
      return {
        recipientId: participant.id,
        role,
        kind: "PERCENTAGE" as const,
        percentageBps: Number(rule.value),
        priority: rule.priority,
        optional: rule.optional,
      };
    }
    return {
      recipientId: participant.id,
      role,
      kind: "FIXED" as const,
      fixedAmount: money(currency, rule.value),
      priority: rule.priority,
      optional: rule.optional,
    };
  });
}
