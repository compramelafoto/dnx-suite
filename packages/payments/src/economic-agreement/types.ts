import type { DistributionRuleKind as ContractsDistributionRuleKind } from "../contracts/entities.js";
import type { RoundingPolicy } from "../distribution/types.js";
import type { FinancialEnvironment, FinancialProvider } from "../financial-identity/types.js";

/** Alias unificado — evita TS2308 con contracts.entities.DistributionRuleKind. */
export type DistributionRuleKind = ContractsDistributionRuleKind;

export type EconomicAgreementStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUPERSEDED"
  | "CLOSED"
  | "SUSPENDED";

export type AgreementParticipantStatus =
  | "INVITED"
  | "ACCEPTED"
  | "ACTIVE"
  | "PAUSED"
  | "EXITED"
  | "REMOVED";

export type AgreementParticipantRoleLabel =
  | "PARTNER"
  | "VENUE_ORGANIZER"
  | "SPONSOR_SCOUT"
  | "SPONSOR"
  | "PLATFORM"
  | "PHOTOGRAPHER"
  | "ORGANIZER"
  | "OTHER";

export type DistributionVersionStatus = "DRAFT" | "PUBLISHED" | "SUPERSEDED";

export interface EconomicAgreement {
  id: string;
  productKey: string;
  scopeType: string;
  scopeId: string;
  name: string;
  countryCode: string;
  currency: string;
  status: EconomicAgreementStatus;
  currentVersionId: string | null;
  createdByUserId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgreementParticipant {
  id: string;
  agreementId: string;
  financialIdentityId: string;
  paymentAccountId: string | null;
  roleLabel: AgreementParticipantRoleLabel;
  status: AgreementParticipantStatus;
  validFrom: Date | null;
  validTo: Date | null;
  invitedByUserId: number;
  approvedByUserId: number | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionVersion {
  id: string;
  agreementId: string;
  versionNumber: number;
  status: DistributionVersionStatus;
  roundingPolicy: RoundingPolicy;
  feePolicy: string | null;
  publishedAt: Date | null;
  publishedByUserId: number | null;
  supersedesVersionId: string | null;
  rulesHash: string | null;
  createdAt: Date;
}

export interface DistributionRuleRecord {
  id: string;
  distributionVersionId: string;
  agreementParticipantId: string;
  kind: DistributionRuleKind;
  /** PERCENTAGE: bps (10000=100%). FIXED: minor units. */
  value: bigint;
  priority: number;
  optional: boolean;
  createdAt: Date;
}

export interface OrderDistributionSnapshotParticipant {
  agreementParticipantId: string;
  financialIdentityId: string;
  paymentAccountId: string | null;
  roleLabel: AgreementParticipantRoleLabel;
  provider: FinancialProvider | null;
  environment: FinancialEnvironment | null;
  providerUserId: string | null;
  consentReference: string | null;
  shareBps: number | null;
  amountMinor: string;
  ruleKind: DistributionRuleKind;
  priority: number;
}

export interface OrderDistributionSnapshotPayload {
  schemaVersion: 1;
  agreementId: string;
  distributionVersionId: string;
  versionNumber: number;
  productKey: string;
  scopeType: string;
  scopeId: string;
  currency: string;
  totalMinor: string;
  publishedByUserId: number | null;
  publishedAt: string | null;
  engineInputHash: string;
  roundingPolicy: RoundingPolicy;
  participants: OrderDistributionSnapshotParticipant[];
}

export interface OrderDistributionSnapshot {
  id: string;
  schemaVersion: 1;
  agreementId: string;
  distributionVersionId: string;
  versionNumber: number;
  productKey: string;
  scopeType: string;
  scopeId: string;
  currency: string;
  totalMinor: bigint;
  payload: OrderDistributionSnapshotPayload;
  engineInputHash: string;
  publishedByUserId: number | null;
  publishedAt: Date | null;
  paymentIntentId: string | null;
  paymentOrderId: string | null;
  externalReference: string | null;
  createdAt: Date;
}

export const PERCENTAGE_BPS_TOTAL = 10_000;
