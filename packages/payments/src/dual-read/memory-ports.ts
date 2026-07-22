import type { CredentialVault } from "../credential-vault/vault.js";
import type { FinancialDomainStore } from "../financial-identity/memory-store.js";
import type {
  DualReadPorts,
  LegacyLabMpRow,
  LegacyUserMpRow,
} from "./types.js";

export function createMemoryDualReadPorts(input: {
  store: FinancialDomainStore;
  vault: CredentialVault;
  legacyUsers?: Map<number, LegacyUserMpRow>;
  legacyLabs?: Map<number, LegacyLabMpRow>;
}): DualReadPorts {
  const legacyUsers = input.legacyUsers ?? new Map();
  const legacyLabs = input.legacyLabs ?? new Map();

  return {
    async loadLegacyUserMp(userId) {
      return legacyUsers.get(userId) ?? null;
    },
    async loadLegacyLabMp(labId) {
      return legacyLabs.get(labId) ?? null;
    },
    async findActivePaymentAccountForUser({ userId, environment, requiredCapability }) {
      const identity = [...input.store.identities.values()].find(
        (i) =>
          i.ownerUserId === userId &&
          i.subjectType === "PERSON" &&
          i.isPrimary &&
          i.status === "ACTIVE",
      );
      if (!identity) return null;
      const accounts = [...input.store.accounts.values()].filter((a) => {
        if (a.financialIdentityId !== identity.id) return false;
        if (a.environment !== environment) return false;
        if (a.status !== "ACTIVE") return false;
        if (
          requiredCapability &&
          !a.capabilities.includes(requiredCapability)
        ) {
          return false;
        }
        return true;
      });
      const account = accounts.find((a) => a.isPrimary) ?? accounts[0];
      if (!account) return null;
      return {
        paymentAccountId: account.id,
        financialIdentityId: identity.id,
        providerUserId: account.providerUserId,
        credentialReference: account.credentialReference,
        status: account.status,
      };
    },
    async findActivePaymentAccountForLab({ labId, environment }) {
      const orgRef = `lab:${labId}`;
      const identity = [...input.store.identities.values()].find(
        (i) => i.organizationRef === orgRef && i.status === "ACTIVE",
      );
      if (!identity) return null;
      const account = [...input.store.accounts.values()].find(
        (a) =>
          a.financialIdentityId === identity.id &&
          a.environment === environment &&
          a.status === "ACTIVE",
      );
      if (!account) return null;
      return {
        paymentAccountId: account.id,
        financialIdentityId: identity.id,
        providerUserId: account.providerUserId,
        credentialReference: account.credentialReference,
        status: account.status,
      };
    },
    async decryptCredential(credentialReference) {
      const payload = await input.vault.decryptMercadoPagoCredential(
        credentialReference,
      );
      return {
        accessToken: payload.accessToken,
        providerUserId: payload.providerUserId,
      };
    },
  };
}
