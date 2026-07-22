import { randomUUID } from "node:crypto";
import type { FinanceGrant } from "../finance-permissions/types.js";
import type {
  AgreementParticipant,
  DistributionRuleRecord,
  DistributionVersion,
  EconomicAgreement,
  OrderDistributionSnapshot,
} from "../economic-agreement/types.js";
import type { FinancialIdentity, PaymentAccount } from "./types.js";

export interface FinanceAuditEvent {
  id: string;
  action: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId: number | null;
  result: "SUCCEEDED" | "FAILED" | "DENIED";
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface FinancialDomainStore {
  identities: Map<string, FinancialIdentity>;
  accounts: Map<string, PaymentAccount>;
  agreements: Map<string, EconomicAgreement>;
  participants: Map<string, AgreementParticipant>;
  versions: Map<string, DistributionVersion>;
  rules: Map<string, DistributionRuleRecord>;
  snapshots: Map<string, OrderDistributionSnapshot>;
  grants: Map<string, FinanceGrant>;
  audit: FinanceAuditEvent[];
  /** Serialize publish operations per agreement (concurrency tests). */
  publishLocks: Set<string>;
}

export function createFinancialDomainStore(): FinancialDomainStore {
  return {
    identities: new Map(),
    accounts: new Map(),
    agreements: new Map(),
    participants: new Map(),
    versions: new Map(),
    rules: new Map(),
    snapshots: new Map(),
    grants: new Map(),
    audit: [],
    publishLocks: new Set(),
  };
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function appendAudit(
  store: FinancialDomainStore,
  event: Omit<FinanceAuditEvent, "id" | "createdAt">,
): void {
  store.audit.push({
    id: newId("aud"),
    createdAt: new Date(),
    ...event,
  });
}
