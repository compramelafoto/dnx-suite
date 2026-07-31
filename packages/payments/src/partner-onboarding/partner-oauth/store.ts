import { randomUUID } from "node:crypto";
import type { FinancialEnvironment } from "../../financial-identity/types.js";
import {
  CLICKATON_MP_OWNER_DEDICATED_MARKER,
  CLICKATON_MP_OWNER_ORG_REF,
} from "../owner-oauth/config.js";
import type { OwnerOAuthStore } from "../owner-oauth/store.js";
import {
  createMemoryOwnerOAuthStore,
  encryptPkceVerifier,
  decryptPkceVerifier,
  maskAccountLabel,
} from "../owner-oauth/store.js";
import type {
  OwnerAccountInvariantSnapshot,
  PartnerFinancialIdentityRecord,
  PartnerOAuthAuditEvent,
  PartnerOAuthStateRecord,
  PartnerPaymentAccountRecord,
} from "./types.js";
import { PARTNER_MP_EXTERNAL_REF, PARTNER_MP_ORIGIN_APP } from "./config.js";
import { snapshotFromAccount } from "./invariants.js";

export { encryptPkceVerifier, decryptPkceVerifier, maskAccountLabel };

export interface PartnerOAuthStore {
  saveState(state: PartnerOAuthStateRecord): Promise<PartnerOAuthStateRecord>;
  getStateByHash(stateHash: string): Promise<PartnerOAuthStateRecord | null>;
  markStateUsed(id: string, at?: Date): Promise<void>;
  getOrCreatePersonIdentity(input: {
    ownerUserId: number;
    legalName?: string;
    countryCode?: string;
  }): Promise<PartnerFinancialIdentityRecord>;
  findPaymentAccountByProviderUser(input: {
    providerUserId: string;
    environment: FinancialEnvironment;
  }): Promise<PartnerPaymentAccountRecord | null>;
  findPartnerPaymentAccount(input: {
    financialIdentityId: string;
    environment: FinancialEnvironment;
  }): Promise<PartnerPaymentAccountRecord | null>;
  upsertPartnerPaymentAccount(
    account: PartnerPaymentAccountRecord,
  ): Promise<PartnerPaymentAccountRecord>;
  /** Read-only snapshot of Clickatón owner collector (never upsert via partner). */
  getOwnerCollectorSnapshot(): Promise<OwnerAccountInvariantSnapshot | null>;
  isPaymentAccountReferencedByActiveDistribution(
    paymentAccountId: string,
  ): Promise<boolean>;
  appendAudit(event: PartnerOAuthAuditEvent): Promise<void>;
  listAudit(): Promise<PartnerOAuthAuditEvent[]>;
}

export function createMemoryPartnerOAuthStore(): PartnerOAuthStore & {
  ownerStore: ReturnType<typeof createMemoryOwnerOAuthStore>;
  activeDistributionAccountIds: Set<string>;
} {
  const ownerStore = createMemoryOwnerOAuthStore();
  const activeDistributionAccountIds = new Set<string>();

  return {
    ownerStore,
    activeDistributionAccountIds,
    saveState: (s) => ownerStore.saveState(s),
    getStateByHash: (h) => ownerStore.getStateByHash(h),
    markStateUsed: (id, at) => ownerStore.markStateUsed(id, at),
    async getOrCreatePersonIdentity(input) {
      for (const id of ownerStore.identities.values()) {
        if (
          id.subjectType === "PERSON" &&
          id.ownerUserId === input.ownerUserId &&
          id.status === "ACTIVE"
        ) {
          return id;
        }
      }
      const record: PartnerFinancialIdentityRecord = {
        id: `fi_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        subjectType: "PERSON",
        ownerUserId: input.ownerUserId,
        organizationRef: null,
        legalName: input.legalName ?? `Partner user ${input.ownerUserId}`,
        status: "ACTIVE",
        countryCode: input.countryCode ?? "AR",
      };
      ownerStore.identities.set(record.id, record);
      return record;
    },
    findPaymentAccountByProviderUser: (input) =>
      ownerStore.findPaymentAccountByProviderUser(input),
    async findPartnerPaymentAccount(input) {
      for (const a of ownerStore.accounts.values()) {
        if (
          a.financialIdentityId === input.financialIdentityId &&
          a.environment === input.environment &&
          a.originApp === PARTNER_MP_ORIGIN_APP &&
          a.externalReference === PARTNER_MP_EXTERNAL_REF
        ) {
          return a;
        }
      }
      // Fallback: any non-owner account on this PERSON FI (migration-friendly).
      for (const a of ownerStore.accounts.values()) {
        if (
          a.financialIdentityId === input.financialIdentityId &&
          a.environment === input.environment &&
          a.externalReference !== CLICKATON_MP_OWNER_DEDICATED_MARKER
        ) {
          return a;
        }
      }
      return null;
    },
    async upsertPartnerPaymentAccount(account) {
      return ownerStore.upsertOwnerPaymentAccount(account);
    },
    async getOwnerCollectorSnapshot() {
      for (const id of ownerStore.identities.values()) {
        if (id.organizationRef === CLICKATON_MP_OWNER_ORG_REF) {
          const acc = await ownerStore.findOwnerPaymentAccount({
            financialIdentityId: id.id,
            environment: "PROD",
          });
          return snapshotFromAccount(acc);
        }
      }
      return null;
    },
    async isPaymentAccountReferencedByActiveDistribution(paymentAccountId) {
      return activeDistributionAccountIds.has(paymentAccountId);
    },
    appendAudit: (e) => ownerStore.appendAudit(e),
    listAudit: () => ownerStore.listAudit(),
  };
}

/** Bridge: wrap an OwnerOAuthStore + person helpers for production prisma adapter. */
export type PartnerPrismaExtras = {
  getOrCreatePersonIdentity: PartnerOAuthStore["getOrCreatePersonIdentity"];
  findPartnerPaymentAccount: PartnerOAuthStore["findPartnerPaymentAccount"];
  getOwnerCollectorSnapshot: PartnerOAuthStore["getOwnerCollectorSnapshot"];
  isPaymentAccountReferencedByActiveDistribution: PartnerOAuthStore["isPaymentAccountReferencedByActiveDistribution"];
};

export function adaptOwnerStoreToPartnerStore(
  owner: OwnerOAuthStore,
  extras: PartnerPrismaExtras,
): PartnerOAuthStore {
  return {
    saveState: (s) => owner.saveState(s),
    getStateByHash: (h) => owner.getStateByHash(h),
    markStateUsed: (id, at) => owner.markStateUsed(id, at),
    getOrCreatePersonIdentity: extras.getOrCreatePersonIdentity,
    findPaymentAccountByProviderUser: (input) =>
      owner.findPaymentAccountByProviderUser(input),
    findPartnerPaymentAccount: extras.findPartnerPaymentAccount,
    upsertPartnerPaymentAccount: (a) => owner.upsertOwnerPaymentAccount(a),
    getOwnerCollectorSnapshot: extras.getOwnerCollectorSnapshot,
    isPaymentAccountReferencedByActiveDistribution:
      extras.isPaymentAccountReferencedByActiveDistribution,
    appendAudit: (e) => owner.appendAudit(e),
    listAudit: () => owner.listAudit(),
  };
}
