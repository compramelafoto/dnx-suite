/**
 * Local Orders 1:N request builder — never sends HTTP.
 * Used for staging validation of DistributionInput → MP split payload shape.
 */
import { calculateDistribution } from "../distribution/calculate.js";
import type { CalculatedDistribution } from "../distribution/types.js";
import type {
  AgreementParticipant,
  DistributionRuleRecord,
  DistributionVersion,
  EconomicAgreement,
} from "../economic-agreement/types.js";
import type { PaymentAccount } from "../financial-identity/types.js";
import { money } from "../money/index.js";
import {
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  inferAmountType,
} from "../providers/mercado-pago/orders/mapper.js";
import { distributionRulesToEngineInput } from "./to-dnx-payments.js";

export interface Orders1nDryRunInput {
  agreement: EconomicAgreement;
  version: DistributionVersion;
  rules: readonly DistributionRuleRecord[];
  participants: readonly AgreementParticipant[];
  accountsById: ReadonlyMap<string, PaymentAccount>;
  totalMinor: bigint;
  /** Fictitious MP receiver ids for TEST — never real production receivers. */
  testReceiverIdsByParticipantId: ReadonlyMap<string, string>;
  ownerParticipantId: string;
  externalReference: string;
  deviceSessionId?: string;
}

export interface Orders1nDryRunResult {
  mode: "SIMULATED_NOT_SENT";
  recipients: number;
  amountType: "fixed" | "percentage";
  totalMinor: string;
  currency: string;
  splits: Array<{
    receiverType: string;
    receiverIdPrefix: string;
    amountMinor?: string;
    amountBps?: number;
  }>;
  payloadHashPrefix: string;
  distribution: CalculatedDistribution;
  realHttpCall: false;
}

function sanitizeReceiverId(id: string): string {
  if (id.length <= 8) return `${id.slice(0, 2)}…`;
  return `${id.slice(0, 4)}…${id.slice(-2)}`;
}

/**
 * Builds the conceptual MP Orders 1:N body without calling Mercado Pago.
 */
export function buildOrders1nDryRun(
  input: Orders1nDryRunInput,
): Orders1nDryRunResult {
  const engineRules = distributionRulesToEngineInput(
    input.rules,
    input.participants,
    input.agreement.currency as "ARS",
  );
  const distribution = calculateDistribution({
    total: money(input.agreement.currency as "ARS", input.totalMinor),
    rules: engineRules,
    rounding: input.version.roundingPolicy,
    eligibleRecipientIds: input.participants.map((p) => p.id),
  });

  const ownerAccount = input.accountsById.get(
    input.participants.find((p) => p.id === input.ownerParticipantId)
      ?.paymentAccountId ?? "",
  );
  const ownerReceiverId =
    input.testReceiverIdsByParticipantId.get(input.ownerParticipantId) ??
    ownerAccount?.providerUserId ??
    "TEST_OWNER";

  const partnerReceiverIds = new Map<string, string>();
  for (const p of input.participants) {
    if (p.id === input.ownerParticipantId) continue;
    const rid = input.testReceiverIdsByParticipantId.get(p.id);
    if (rid) partnerReceiverIds.set(p.id, rid);
  }

  const amountType = inferAmountType(distribution);
  const entries = buildSplitEntriesFromDistribution(
    distribution,
    ownerReceiverId,
    partnerReceiverIds,
  );

  const built = buildMercadoPagoSplitOrderRequest({
    externalReference: input.externalReference,
    total: money(input.agreement.currency as "ARS", input.totalMinor),
    amountType,
    entries,
    deviceSessionId: input.deviceSessionId ?? "TEST_DEVICE_SESSION_10D3I_E",
  });

  return {
    mode: "SIMULATED_NOT_SENT",
    recipients: entries.length,
    amountType,
    totalMinor: input.totalMinor.toString(),
    currency: input.agreement.currency,
    splits: entries.map((e) => ({
      receiverType: e.receiverType,
      receiverIdPrefix: sanitizeReceiverId(e.receiverId),
      ...(e.amount
        ? { amountMinor: e.amount.amountMinor.toString() }
        : {}),
      ...(e.amountBps != null ? { amountBps: e.amountBps } : {}),
    })),
    payloadHashPrefix: built.payloadHash.slice(0, 12),
    distribution,
    realHttpCall: false,
  };
}
