import type { OwnerAccountInvariantSnapshot } from "./types.js";
import { PartnerOAuthError } from "./types.js";

/**
 * Owner collector must be identical before/after partner OAuth mutations.
 */
export function assertOwnerAccountUnchanged(
  before: OwnerAccountInvariantSnapshot | null,
  after: OwnerAccountInvariantSnapshot | null,
): void {
  if (before == null && after == null) return;
  if (before == null || after == null) {
    throw new PartnerOAuthError(
      "OWNER_ACCOUNT_REGRESSION",
      "Owner payment account presence changed during partner OAuth",
    );
  }
  if (
    before.id !== after.id ||
    before.status !== after.status ||
    before.credentialReference !== after.credentialReference ||
    before.providerUserId !== after.providerUserId ||
    before.financialIdentityId !== after.financialIdentityId
  ) {
    throw new PartnerOAuthError(
      "OWNER_ACCOUNT_REGRESSION",
      "Owner payment account mutated during partner OAuth",
    );
  }
}

export function snapshotFromAccount(account: {
  id: string;
  status: string;
  credentialReference: string | null;
  providerUserId: string | null;
  financialIdentityId: string;
} | null): OwnerAccountInvariantSnapshot | null {
  if (!account) return null;
  return {
    id: account.id,
    status: account.status,
    credentialReference: account.credentialReference,
    providerUserId: account.providerUserId,
    financialIdentityId: account.financialIdentityId,
  };
}
