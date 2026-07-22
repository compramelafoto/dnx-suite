import {
  CredentialVault,
  fingerprintAccessToken,
  sanitizeCredentialAuditMeta,
  sanitizeMpUserId,
  type CredentialRecordStore,
} from "../../credential-vault/index.js";
import type { FinancialDomainStore } from "../../financial-identity/memory-store.js";
import { appendAudit, newId } from "../../financial-identity/memory-store.js";
import type {
  FinancialEnvironment,
  FinancialIdentity,
  PaymentAccount,
} from "../../financial-identity/types.js";
import type { LegacyLabMpRow, LegacyUserMpRow } from "../../dual-read/types.js";

export type BackfillClassification =
  | "ELIGIBLE"
  | "ALREADY_MIGRATED"
  | "CONFLICT_PROVIDER_ID"
  | "CONFLICT_IDENTITY"
  | "INCOMPLETE"
  | "ENVIRONMENT_UNKNOWN"
  | "REVIEW_REQUIRED"
  | "SKIPPED";

export interface BackfillReportRow {
  sourceType: "user" | "lab";
  legacyRecordId: number;
  userId: number | null;
  labId: number | null;
  emailSanitized: string | null;
  mpUserIdSanitized: string | null;
  destinationIdentityId: string | null;
  destinationAccountId: string | null;
  classification: BackfillClassification;
  reason: string;
  actionProposed: "MIGRATE" | "SKIP" | "NONE";
  idempotencyKey: string;
}

export interface BackfillSummary {
  dryRun: boolean;
  environment: FinancialEnvironment;
  rows: BackfillReportRow[];
  counts: Record<BackfillClassification, number>;
  written: number;
}

function emptyCounts(): Record<BackfillClassification, number> {
  return {
    ELIGIBLE: 0,
    ALREADY_MIGRATED: 0,
    CONFLICT_PROVIDER_ID: 0,
    CONFLICT_IDENTITY: 0,
    INCOMPLETE: 0,
    ENVIRONMENT_UNKNOWN: 0,
    REVIEW_REQUIRED: 0,
    SKIPPED: 0,
  };
}

export function classifyLegacyUserRow(
  row: LegacyUserMpRow,
  store: FinancialDomainStore,
  environment: FinancialEnvironment,
): BackfillReportRow {
  const idempotencyKey = `user:${row.userId}:MERCADOPAGO:${environment}:${row.mpUserId ?? "none"}`;
  const base = {
    sourceType: "user" as const,
    legacyRecordId: row.userId,
    userId: row.userId,
    labId: null,
    emailSanitized: null,
    mpUserIdSanitized: sanitizeMpUserId(row.mpUserId),
    destinationIdentityId: null,
    destinationAccountId: null,
    idempotencyKey,
  };

  if (!row.mpUserId || !row.mpAccessToken) {
    return {
      ...base,
      classification: "INCOMPLETE",
      reason: !row.mpUserId ? "missing_mpUserId" : "missing_access_token",
      actionProposed: "SKIP",
    };
  }

  const existingAccount = [...store.accounts.values()].find(
    (a) =>
      a.provider === "MERCADOPAGO" &&
      a.environment === environment &&
      a.providerUserId === row.mpUserId &&
      ["PENDING", "ACTIVE", "NEEDS_REAUTH"].includes(a.status),
  );

  if (existingAccount) {
    const identity = store.identities.get(existingAccount.financialIdentityId);
    if (identity?.ownerUserId === row.userId) {
      return {
        ...base,
        destinationIdentityId: identity.id,
        destinationAccountId: existingAccount.id,
        classification: "ALREADY_MIGRATED",
        reason: "payment_account_exists_for_same_user",
        actionProposed: "NONE",
      };
    }
    return {
      ...base,
      destinationIdentityId: existingAccount.financialIdentityId,
      destinationAccountId: existingAccount.id,
      classification: "CONFLICT_PROVIDER_ID",
      reason: "providerUserId_linked_to_other_identity",
      actionProposed: "SKIP",
    };
  }

  const fingerprint = fingerprintAccessToken(row.mpAccessToken);
  const fpConflict = [...store.accounts.values()].find(
    (a) => a.tokenFingerprint === fingerprint && a.environment === environment,
  );
  if (fpConflict) {
    return {
      ...base,
      destinationAccountId: fpConflict.id,
      classification: "CONFLICT_IDENTITY",
      reason: "token_fingerprint_collision",
      actionProposed: "SKIP",
    };
  }

  return {
    ...base,
    classification: "ELIGIBLE",
    reason: "ready_to_migrate",
    actionProposed: "MIGRATE",
  };
}

export function classifyLegacyLabRow(
  row: LegacyLabMpRow,
  store: FinancialDomainStore,
  environment: FinancialEnvironment,
): BackfillReportRow {
  const orgRef = `lab:${row.labId}`;
  const idempotencyKey = `lab:${row.labId}:MERCADOPAGO:${environment}:${row.mpUserId ?? "none"}`;
  const base = {
    sourceType: "lab" as const,
    legacyRecordId: row.labId,
    userId: row.ownerUserId,
    labId: row.labId,
    emailSanitized: null,
    mpUserIdSanitized: sanitizeMpUserId(row.mpUserId),
    destinationIdentityId: null,
    destinationAccountId: null,
    idempotencyKey,
  };

  if (!row.mpUserId || !row.mpAccessToken) {
    return {
      ...base,
      classification: "INCOMPLETE",
      reason: !row.mpUserId ? "missing_mpUserId" : "missing_access_token",
      actionProposed: "SKIP",
    };
  }

  if (row.ownerUserId == null) {
    return {
      ...base,
      classification: "REVIEW_REQUIRED",
      reason: "lab_missing_owner_user",
      actionProposed: "SKIP",
    };
  }

  // Same mpUserId already on a PERSON identity → review (User+Lab share).
  const personConflict = [...store.accounts.values()].find((a) => {
    if (a.providerUserId !== row.mpUserId || a.environment !== environment) {
      return false;
    }
    const identity = store.identities.get(a.financialIdentityId);
    return identity?.subjectType === "PERSON";
  });
  if (personConflict) {
    return {
      ...base,
      destinationAccountId: personConflict.id,
      classification: "REVIEW_REQUIRED",
      reason: "mpUserId_also_on_person_identity",
      actionProposed: "SKIP",
    };
  }

  const existingOrg = [...store.identities.values()].find(
    (i) => i.organizationRef === orgRef,
  );
  if (existingOrg) {
    const account = [...store.accounts.values()].find(
      (a) =>
        a.financialIdentityId === existingOrg.id &&
        a.providerUserId === row.mpUserId &&
        a.environment === environment,
    );
    if (account) {
      return {
        ...base,
        destinationIdentityId: existingOrg.id,
        destinationAccountId: account.id,
        classification: "ALREADY_MIGRATED",
        reason: "lab_org_account_exists",
        actionProposed: "NONE",
      };
    }
  }

  return {
    ...base,
    classification: "ELIGIBLE",
    reason: "ready_to_migrate_lab_organization",
    actionProposed: "MIGRATE",
  };
}

export async function runLegacyMpBackfill(input: {
  store: FinancialDomainStore;
  credentialStore: CredentialRecordStore;
  users: LegacyUserMpRow[];
  labs: LegacyLabMpRow[];
  environment: FinancialEnvironment;
  dryRun: boolean;
  source?: "user" | "lab" | "all";
  limit?: number;
}): Promise<BackfillSummary> {
  const vault = new CredentialVault(input.credentialStore);
  const source = input.source ?? "all";
  const rows: BackfillReportRow[] = [];
  let written = 0;

  const userRows = source === "lab" ? [] : input.users;
  const labRows = source === "user" ? [] : input.labs;

  for (const user of userRows) {
    if (input.limit != null && rows.length >= input.limit) break;
    const classified = classifyLegacyUserRow(user, input.store, input.environment);
    if (!input.dryRun && classified.classification === "ELIGIBLE") {
      const migrated = await migrateUser(input.store, vault, user, input.environment);
      classified.destinationIdentityId = migrated.identityId;
      classified.destinationAccountId = migrated.accountId;
      written += 1;
      appendAudit(input.store, {
        action: "PAYMENT_ACCOUNT_MIGRATED",
        aggregateType: "PaymentAccount",
        aggregateId: migrated.accountId,
        actorUserId: user.userId,
        result: "SUCCEEDED",
        metadata: sanitizeCredentialAuditMeta({
          source: "compramelafoto_legacy_user",
          environment: input.environment,
          mpUserId: sanitizeMpUserId(user.mpUserId),
        }),
      });
    } else if (classified.classification === "ALREADY_MIGRATED") {
      appendAudit(input.store, {
        action: "PAYMENT_ACCOUNT_ALREADY_MIGRATED",
        aggregateType: "User",
        aggregateId: String(user.userId),
        actorUserId: user.userId,
        result: "SUCCEEDED",
        metadata: { environment: input.environment },
      });
    }
    rows.push(classified);
  }

  for (const lab of labRows) {
    if (input.limit != null && rows.length >= input.limit) break;
    const classified = classifyLegacyLabRow(lab, input.store, input.environment);
    if (!input.dryRun && classified.classification === "ELIGIBLE") {
      const migrated = await migrateLab(input.store, vault, lab, input.environment);
      classified.destinationIdentityId = migrated.identityId;
      classified.destinationAccountId = migrated.accountId;
      written += 1;
      appendAudit(input.store, {
        action: "PAYMENT_ACCOUNT_MIGRATED",
        aggregateType: "PaymentAccount",
        aggregateId: migrated.accountId,
        actorUserId: lab.ownerUserId,
        result: "SUCCEEDED",
        metadata: sanitizeCredentialAuditMeta({
          source: "compramelafoto_legacy_lab",
          labId: lab.labId,
          environment: input.environment,
          mpUserId: sanitizeMpUserId(lab.mpUserId),
        }),
      });
    }
    rows.push(classified);
  }

  const counts = emptyCounts();
  for (const row of rows) counts[row.classification] += 1;

  return {
    dryRun: input.dryRun,
    environment: input.environment,
    rows,
    counts,
    written,
  };
}

async function migrateUser(
  store: FinancialDomainStore,
  vault: CredentialVault,
  row: LegacyUserMpRow,
  environment: FinancialEnvironment,
): Promise<{ identityId: string; accountId: string }> {
  let identity = [...store.identities.values()].find(
    (i) =>
      i.ownerUserId === row.userId &&
      i.subjectType === "PERSON" &&
      i.isPrimary &&
      (i.status === "ACTIVE" || i.status === "DRAFT"),
  );
  const now = new Date();
  if (!identity) {
    identity = {
      id: newId("fi"),
      subjectType: "PERSON",
      ownerUserId: row.userId,
      isPrimary: true,
      organizationRef: null,
      legalName: null,
      taxId: null,
      countryCode: "AR",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    store.identities.set(identity.id, identity);
    appendAudit(store, {
      action: "FINANCIAL_IDENTITY_CREATED",
      aggregateType: "FinancialIdentity",
      aggregateId: identity.id,
      actorUserId: row.userId,
      result: "SUCCEEDED",
      metadata: { subjectType: "PERSON" },
    });
  }

  const encrypted = await vault.encryptMercadoPagoCredential({
    environment,
    payload: {
      accessToken: row.mpAccessToken!,
      refreshToken: row.mpRefreshToken,
      providerUserId: row.mpUserId!,
      connectedAt: row.mpConnectedAt?.toISOString() ?? null,
      origin: "compramelafoto_legacy_user",
    },
  });

  const account: PaymentAccount = {
    id: newId("pa"),
    financialIdentityId: identity.id,
    provider: "MERCADOPAGO",
    environment,
    providerUserId: row.mpUserId,
    externalReference: `user:${row.userId}`,
    credentialReference: encrypted.id,
    consentReference: null,
    originApp: "compramelafoto",
    legacySource: "compramelafoto_legacy_user",
    tokenFingerprint: fingerprintAccessToken(row.mpAccessToken!),
    connectedAt: row.mpConnectedAt,
    capabilities: ["COLLECTOR", "SPLIT_RECEIVER"],
    isPrimary: true,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  store.accounts.set(account.id, account);
  return { identityId: identity.id, accountId: account.id };
}

async function migrateLab(
  store: FinancialDomainStore,
  vault: CredentialVault,
  row: LegacyLabMpRow,
  environment: FinancialEnvironment,
): Promise<{ identityId: string; accountId: string }> {
  const orgRef = `lab:${row.labId}`;
  const now = new Date();
  let identity = [...store.identities.values()].find((i) => i.organizationRef === orgRef);
  if (!identity) {
    identity = {
      id: newId("fi"),
      subjectType: "ORGANIZATION",
      ownerUserId: row.ownerUserId,
      isPrimary: false,
      organizationRef: orgRef,
      legalName: row.name,
      taxId: null,
      countryCode: row.country?.slice(0, 2)?.toUpperCase() === "AR" ? "AR" : "AR",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    } satisfies FinancialIdentity;
    store.identities.set(identity.id, identity);
    appendAudit(store, {
      action: "FINANCIAL_IDENTITY_CREATED",
      aggregateType: "FinancialIdentity",
      aggregateId: identity.id,
      actorUserId: row.ownerUserId,
      result: "SUCCEEDED",
      metadata: { subjectType: "ORGANIZATION", organizationRef: orgRef },
    });
  }

  const encrypted = await vault.encryptMercadoPagoCredential({
    environment,
    payload: {
      accessToken: row.mpAccessToken!,
      refreshToken: row.mpRefreshToken,
      providerUserId: row.mpUserId!,
      connectedAt: row.mpConnectedAt?.toISOString() ?? null,
      origin: "compramelafoto_legacy_lab",
    },
  });

  const account: PaymentAccount = {
    id: newId("pa"),
    financialIdentityId: identity.id,
    provider: "MERCADOPAGO",
    environment,
    providerUserId: row.mpUserId,
    externalReference: orgRef,
    credentialReference: encrypted.id,
    consentReference: null,
    originApp: "compramelafoto",
    legacySource: "compramelafoto_legacy_lab",
    tokenFingerprint: fingerprintAccessToken(row.mpAccessToken!),
    connectedAt: row.mpConnectedAt,
    capabilities: ["COLLECTOR", "SPLIT_RECEIVER"],
    isPrimary: true,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
  store.accounts.set(account.id, account);
  return { identityId: identity.id, accountId: account.id };
}

/** Operational rollback: disable migrated account; never delete legacy columns. */
export function rollbackMigratedPaymentAccount(
  store: FinancialDomainStore,
  accountId: string,
  actorUserId: number | null,
  reason: string,
): void {
  const account = store.accounts.get(accountId);
  if (!account) return;
  store.accounts.set(accountId, {
    ...account,
    status: "DISABLED",
    updatedAt: new Date(),
  });
  appendAudit(store, {
    action: "PAYMENT_ACCOUNT_ROLLBACK_DISABLED",
    aggregateType: "PaymentAccount",
    aggregateId: accountId,
    actorUserId,
    result: "SUCCEEDED",
    metadata: { reason },
  });
}
