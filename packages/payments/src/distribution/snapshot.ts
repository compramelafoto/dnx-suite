import { createHash } from "node:crypto";
import { calculateDistribution } from "./calculate.js";
import type { RoundingPolicy } from "./types.js";
import type { DistributionRule } from "../contracts/entities.js";
import type { RecipientRole } from "../contracts/primitives.js";
import type { CurrencyCode } from "../contracts/primitives.js";
import { money } from "../money/index.js";
import type {
  AgreementParticipant,
  AgreementParticipantRoleLabel,
  DistributionRuleRecord,
  DistributionVersion,
  EconomicAgreement,
  OrderDistributionSnapshot,
  OrderDistributionSnapshotPayload,
} from "../economic-agreement/types.js";
import type { PaymentAccount } from "../financial-identity/types.js";
import { newId } from "../financial-identity/memory-store.js";

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

export function hashEngineInput(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildOrderDistributionSnapshot(input: {
  agreement: EconomicAgreement;
  version: DistributionVersion;
  rules: readonly DistributionRuleRecord[];
  participants: readonly AgreementParticipant[];
  accountsById: ReadonlyMap<string, PaymentAccount>;
  totalMinor: bigint;
  currency: CurrencyCode;
  externalReference?: string | null;
  paymentIntentId?: string | null;
  paymentOrderId?: string | null;
}): OrderDistributionSnapshot {
  if (input.version.status !== "PUBLISHED") {
    throw new Error("snapshot requires a PUBLISHED distribution version");
  }

  const participantById = new Map(input.participants.map((p) => [p.id, p]));
  const engineRules: DistributionRule[] = input.rules.map((rule) => {
    const participant = participantById.get(rule.agreementParticipantId);
    if (!participant) {
      throw new Error(`rule participant missing: ${rule.agreementParticipantId}`);
    }
    const base = {
      recipientId: participant.id,
      role: roleFromLabel(participant.roleLabel),
      priority: rule.priority,
      optional: rule.optional,
    };
    if (rule.kind === "PERCENTAGE") {
      return {
        ...base,
        kind: "PERCENTAGE" as const,
        percentageBps: Number(rule.value),
      };
    }
    return {
      ...base,
      kind: "FIXED" as const,
      fixedAmount: money(input.currency, rule.value),
    };
  });

  const eligible = input.participants
    .filter((p) => p.status === "ACTIVE" || p.status === "ACCEPTED")
    .map((p) => p.id);

  const calculated = calculateDistribution({
    total: money(input.currency, input.totalMinor),
    rules: engineRules,
    rounding: input.version.roundingPolicy as RoundingPolicy,
    eligibleRecipientIds: eligible,
  });

  const amountByParticipant = new Map(
    calculated.entries.map((e) => [e.recipientId, e.amount.amountMinor]),
  );

  const payloadParticipants = input.rules.map((rule) => {
    const participant = participantById.get(rule.agreementParticipantId)!;
    const account = participant.paymentAccountId
      ? input.accountsById.get(participant.paymentAccountId) ?? null
      : null;
    return {
      agreementParticipantId: participant.id,
      financialIdentityId: participant.financialIdentityId,
      paymentAccountId: participant.paymentAccountId,
      roleLabel: participant.roleLabel,
      provider: account?.provider ?? null,
      environment: account?.environment ?? null,
      providerUserId: account?.providerUserId ?? null,
      consentReference: account?.consentReference ?? null,
      shareBps: rule.kind === "PERCENTAGE" ? Number(rule.value) : null,
      amountMinor: (amountByParticipant.get(participant.id) ?? 0n).toString(),
      ruleKind: rule.kind,
      priority: rule.priority,
    };
  });

  const engineInputHash = hashEngineInput({
    agreementId: input.agreement.id,
    versionId: input.version.id,
    versionNumber: input.version.versionNumber,
    currency: input.currency,
    totalMinor: input.totalMinor.toString(),
    roundingPolicy: input.version.roundingPolicy,
    rules: input.rules.map((r) => ({
      participantId: r.agreementParticipantId,
      kind: r.kind,
      value: r.value.toString(),
      priority: r.priority,
      optional: r.optional,
    })),
    participants: payloadParticipants.map((p) => ({
      id: p.agreementParticipantId,
      identityId: p.financialIdentityId,
      accountId: p.paymentAccountId,
      providerUserId: p.providerUserId,
      consentReference: p.consentReference,
    })),
  });

  const payload: OrderDistributionSnapshotPayload = {
    schemaVersion: 1,
    agreementId: input.agreement.id,
    distributionVersionId: input.version.id,
    versionNumber: input.version.versionNumber,
    productKey: input.agreement.productKey,
    scopeType: input.agreement.scopeType,
    scopeId: input.agreement.scopeId,
    currency: input.currency,
    totalMinor: input.totalMinor.toString(),
    publishedByUserId: input.version.publishedByUserId,
    publishedAt: input.version.publishedAt?.toISOString() ?? null,
    engineInputHash,
    roundingPolicy: input.version.roundingPolicy,
    participants: payloadParticipants,
  };

  // Defense: never allow credentialReference into payload.
  const serialized = JSON.stringify(payload);
  if (serialized.includes("credentialReference")) {
    throw new Error("snapshot payload must not include credentialReference");
  }

  return {
    id: newId("ods"),
    schemaVersion: 1,
    agreementId: input.agreement.id,
    distributionVersionId: input.version.id,
    versionNumber: input.version.versionNumber,
    productKey: input.agreement.productKey,
    scopeType: input.agreement.scopeType,
    scopeId: input.agreement.scopeId,
    currency: input.currency,
    totalMinor: input.totalMinor,
    payload,
    engineInputHash,
    publishedByUserId: input.version.publishedByUserId,
    publishedAt: input.version.publishedAt,
    paymentIntentId: input.paymentIntentId ?? null,
    paymentOrderId: input.paymentOrderId ?? null,
    externalReference: input.externalReference ?? null,
    createdAt: new Date(),
  };
}

/** Compatible JSON for existing Intent/Order.distributionSnapshot column. */
export function toCompatibleDistributionSnapshotJson(
  snapshot: OrderDistributionSnapshot,
): Record<string, unknown> {
  return {
    schemaVersion: snapshot.schemaVersion,
    formalSnapshotId: snapshot.id,
    agreementId: snapshot.agreementId,
    distributionVersionId: snapshot.distributionVersionId,
    versionNumber: snapshot.versionNumber,
    productKey: snapshot.productKey,
    scopeType: snapshot.scopeType,
    scopeId: snapshot.scopeId,
    currency: snapshot.currency,
    totalMinor: snapshot.totalMinor.toString(),
    engineInputHash: snapshot.engineInputHash,
    participants: snapshot.payload.participants,
    publishedByUserId: snapshot.publishedByUserId,
    publishedAt: snapshot.publishedAt?.toISOString() ?? null,
  };
}
