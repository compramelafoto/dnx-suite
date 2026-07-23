import { createHash, randomUUID } from "node:crypto";
import { decodeMasterKey, decryptUtf8, encryptUtf8 } from "../../credential-vault/aes-gcm.js";
import type { FinancialEnvironment } from "../../financial-identity/types.js";
import type {
  OwnerFinancialIdentityRecord,
  OwnerOAuthAuditEvent,
  OwnerOAuthStateRecord,
  OwnerPaymentAccountRecord,
} from "./types.js";

export interface OwnerOAuthStore {
  saveState(state: OwnerOAuthStateRecord): Promise<OwnerOAuthStateRecord>;
  getStateByHash(stateHash: string): Promise<OwnerOAuthStateRecord | null>;
  markStateUsed(id: string, at?: Date): Promise<void>;
  getOrCreateOwnerIdentity(input: {
    organizationRef: string;
    ownerUserId: number;
    legalName: string;
    countryCode?: string;
  }): Promise<OwnerFinancialIdentityRecord>;
  findPaymentAccountByProviderUser(input: {
    providerUserId: string;
    environment: FinancialEnvironment;
  }): Promise<OwnerPaymentAccountRecord | null>;
  findOwnerPaymentAccount(input: {
    financialIdentityId: string;
    environment: FinancialEnvironment;
  }): Promise<OwnerPaymentAccountRecord | null>;
  upsertOwnerPaymentAccount(
    account: OwnerPaymentAccountRecord,
  ): Promise<OwnerPaymentAccountRecord>;
  appendAudit(event: OwnerOAuthAuditEvent): Promise<void>;
  listAudit(): Promise<OwnerOAuthAuditEvent[]>;
}

export function createMemoryOwnerOAuthStore(): OwnerOAuthStore & {
  states: Map<string, OwnerOAuthStateRecord>;
  identities: Map<string, OwnerFinancialIdentityRecord>;
  accounts: Map<string, OwnerPaymentAccountRecord>;
  audits: OwnerOAuthAuditEvent[];
} {
  const states = new Map<string, OwnerOAuthStateRecord>();
  const identities = new Map<string, OwnerFinancialIdentityRecord>();
  const accounts = new Map<string, OwnerPaymentAccountRecord>();
  const audits: OwnerOAuthAuditEvent[] = [];

  return {
    states,
    identities,
    accounts,
    audits,
    async saveState(state) {
      states.set(state.stateHash, state);
      return state;
    },
    async getStateByHash(stateHash) {
      return states.get(stateHash) ?? null;
    },
    async markStateUsed(id, at = new Date()) {
      for (const [hash, row] of states) {
        if (row.id === id) {
          states.set(hash, { ...row, usedAt: at });
          return;
        }
      }
    },
    async getOrCreateOwnerIdentity(input) {
      for (const id of identities.values()) {
        if (id.organizationRef === input.organizationRef && id.status === "ACTIVE") {
          return id;
        }
      }
      const record: OwnerFinancialIdentityRecord = {
        id: `fi_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        subjectType: "ORGANIZATION",
        ownerUserId: input.ownerUserId,
        organizationRef: input.organizationRef,
        legalName: input.legalName,
        status: "ACTIVE",
        countryCode: input.countryCode ?? "AR",
      };
      identities.set(record.id, record);
      return record;
    },
    async findPaymentAccountByProviderUser(input) {
      for (const a of accounts.values()) {
        if (
          a.providerUserId === input.providerUserId &&
          a.environment === input.environment &&
          a.status !== "REVOKED" &&
          a.status !== "DISABLED"
        ) {
          return a;
        }
      }
      return null;
    },
    async findOwnerPaymentAccount(input) {
      for (const a of accounts.values()) {
        if (
          a.financialIdentityId === input.financialIdentityId &&
          a.environment === input.environment
        ) {
          return a;
        }
      }
      return null;
    },
    async upsertOwnerPaymentAccount(account) {
      accounts.set(account.id, account);
      return account;
    },
    async appendAudit(event) {
      audits.push(event);
    },
    async listAudit() {
      return [...audits];
    },
  };
}

/** Encrypt PKCE verifier with vault master key material (32-byte base64). */
export function encryptPkceVerifier(
  verifier: string,
  masterKeyBase64: string,
): { ciphertext: string; nonce: string; authTag: string } {
  const key = decodeMasterKey(masterKeyBase64);
  return encryptUtf8(verifier, key);
}

export function decryptPkceVerifier(
  parts: { ciphertext: string; nonce: string; authTag: string },
  masterKeyBase64: string,
): string {
  const key = decodeMasterKey(masterKeyBase64);
  return decryptUtf8(parts, key);
}

export function maskAccountLabel(providerUserId: string | null): string | null {
  if (!providerUserId) return null;
  if (providerUserId.length <= 6) return "••••";
  return `${providerUserId.slice(0, 2)}••••${providerUserId.slice(-2)}`;
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const u = user.length <= 2 ? "**" : `${user.slice(0, 1)}***`;
  return `${u}@${domain[0]}***`;
}

export function fingerprintOpaque(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}
