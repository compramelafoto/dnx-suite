import { FinancialIdentityError } from "./errors.js";
import {
  appendAudit,
  newId,
  type FinancialDomainStore,
} from "./memory-store.js";
import {
  toPublicPaymentAccount,
  type FinancialEnvironment,
  type FinancialIdentity,
  type FinancialProvider,
  type PaymentAccount,
  type PaymentAccountCapability,
  type PublicPaymentAccount,
} from "./types.js";

const LIVE_ACCOUNT_STATUSES = new Set(["PENDING", "ACTIVE", "NEEDS_REAUTH"]);

export interface RegisterPaymentAccountInput {
  financialIdentityId: string;
  provider: FinancialProvider;
  environment: FinancialEnvironment;
  providerUserId?: string | null;
  externalReference?: string | null;
  /** Opaque vault key only — never a raw token. */
  credentialReference?: string | null;
  consentReference?: string | null;
  originApp?: string | null;
  capabilities?: PaymentAccountCapability[];
  isPrimary?: boolean;
  status?: PaymentAccount["status"];
  actorUserId?: number | null;
}

export class FinancialIdentityService {
  constructor(private readonly store: FinancialDomainStore) {}

  getOrCreatePrimaryFinancialIdentityForUser(input: {
    userId: number;
    countryCode?: string;
    legalName?: string | null;
  }): FinancialIdentity {
    const existing = [...this.store.identities.values()].find(
      (i) =>
        i.ownerUserId === input.userId &&
        i.subjectType === "PERSON" &&
        i.isPrimary &&
        (i.status === "DRAFT" || i.status === "ACTIVE"),
    );
    if (existing) return existing;

    const now = new Date();
    const identity: FinancialIdentity = {
      id: newId("fi"),
      subjectType: "PERSON",
      ownerUserId: input.userId,
      isPrimary: true,
      legalName: input.legalName ?? null,
      taxId: null,
      countryCode: input.countryCode ?? "AR",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    this.store.identities.set(identity.id, identity);
    appendAudit(this.store, {
      action: "financial_identity.create_primary",
      aggregateType: "FinancialIdentity",
      aggregateId: identity.id,
      actorUserId: input.userId,
      result: "SUCCEEDED",
      metadata: { userId: input.userId },
    });
    return identity;
  }

  createOrganizationIdentity(input: {
    countryCode: string;
    legalName: string;
    taxId?: string | null;
    ownerUserId?: number | null;
  }): FinancialIdentity {
    const now = new Date();
    const identity: FinancialIdentity = {
      id: newId("fi"),
      subjectType: "ORGANIZATION",
      ownerUserId: input.ownerUserId ?? null,
      isPrimary: false,
      legalName: input.legalName,
      taxId: input.taxId ?? null,
      countryCode: input.countryCode,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    this.store.identities.set(identity.id, identity);
    return identity;
  }

  getFinancialIdentity(id: string): FinancialIdentity {
    const identity = this.store.identities.get(id);
    if (!identity) {
      throw new FinancialIdentityError("IDENTITY_NOT_FOUND", `identity not found: ${id}`);
    }
    return identity;
  }

  listPaymentAccounts(financialIdentityId: string): PublicPaymentAccount[] {
    this.getFinancialIdentity(financialIdentityId);
    return [...this.store.accounts.values()]
      .filter((a) => a.financialIdentityId === financialIdentityId)
      .map(toPublicPaymentAccount);
  }

  registerPaymentAccountReference(input: RegisterPaymentAccountInput): PublicPaymentAccount {
    const identity = this.getFinancialIdentity(input.financialIdentityId);
    if (identity.status === "ARCHIVED" || identity.status === "SUSPENDED") {
      throw new FinancialIdentityError(
        "IDENTITY_NOT_ACTIVE",
        "cannot register account on suspended/archived identity",
      );
    }

    if (input.credentialReference && looksLikeRawToken(input.credentialReference)) {
      throw new FinancialIdentityError(
        "RAW_TOKEN_FORBIDDEN",
        "credentialReference must be an opaque vault pointer, not a raw token",
      );
    }

    const providerUserId = input.providerUserId ?? null;
    if (providerUserId) {
      const conflict = [...this.store.accounts.values()].find(
        (a) =>
          a.provider === input.provider &&
          a.environment === input.environment &&
          a.providerUserId === providerUserId &&
          LIVE_ACCOUNT_STATUSES.has(a.status),
      );
      if (conflict) {
        throw new FinancialIdentityError(
          "PROVIDER_ACCOUNT_CONFLICT",
          "provider+providerUserId+environment already linked to a live identity",
        );
      }
    }

    const now = new Date();
    if (input.isPrimary) {
      for (const account of this.store.accounts.values()) {
        if (
          account.financialIdentityId === input.financialIdentityId &&
          account.environment === input.environment &&
          account.isPrimary
        ) {
          this.store.accounts.set(account.id, {
            ...account,
            isPrimary: false,
            updatedAt: now,
          });
        }
      }
    }

    const account: PaymentAccount = {
      id: newId("pa"),
      financialIdentityId: input.financialIdentityId,
      provider: input.provider,
      environment: input.environment,
      providerUserId,
      externalReference: input.externalReference ?? null,
      credentialReference: input.credentialReference ?? null,
      consentReference: input.consentReference ?? null,
      originApp: input.originApp ?? null,
      capabilities: input.capabilities ?? ["COLLECTOR", "SPLIT_RECEIVER"],
      isPrimary: Boolean(input.isPrimary),
      status: input.status ?? "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };
    this.store.accounts.set(account.id, account);
    appendAudit(this.store, {
      action: "payment_account.register_reference",
      aggregateType: "PaymentAccount",
      aggregateId: account.id,
      actorUserId: input.actorUserId ?? null,
      result: "SUCCEEDED",
      metadata: {
        provider: account.provider,
        environment: account.environment,
        providerUserId: account.providerUserId,
        hasCredentialReference: Boolean(account.credentialReference),
      },
    });
    return toPublicPaymentAccount(account);
  }

  setPrimaryPaymentAccount(accountId: string): PublicPaymentAccount {
    const account = this.requireAccount(accountId);
    const now = new Date();
    for (const other of this.store.accounts.values()) {
      if (
        other.financialIdentityId === account.financialIdentityId &&
        other.environment === account.environment
      ) {
        this.store.accounts.set(other.id, {
          ...other,
          isPrimary: other.id === accountId,
          updatedAt: now,
        });
      }
    }
    return toPublicPaymentAccount(this.requireAccount(accountId));
  }

  suspendPaymentAccount(accountId: string): PublicPaymentAccount {
    const account = this.requireAccount(accountId);
    const updated: PaymentAccount = {
      ...account,
      status: "DISABLED",
      updatedAt: new Date(),
    };
    this.store.accounts.set(accountId, updated);
    return toPublicPaymentAccount(updated);
  }

  resolveEligiblePaymentAccount(input: {
    financialIdentityId: string;
    environment: FinancialEnvironment;
    provider?: FinancialProvider;
    requiredCapability?: PaymentAccountCapability;
  }): PublicPaymentAccount | null {
    const candidates = [...this.store.accounts.values()].filter((a) => {
      if (a.financialIdentityId !== input.financialIdentityId) return false;
      if (a.environment !== input.environment) return false;
      if (a.status !== "ACTIVE") return false;
      if (input.provider && a.provider !== input.provider) return false;
      if (
        input.requiredCapability &&
        !a.capabilities.includes(input.requiredCapability)
      ) {
        return false;
      }
      return true;
    });
    if (candidates.length === 0) return null;
    const primary = candidates.find((c) => c.isPrimary);
    return toPublicPaymentAccount(primary ?? candidates[0]!);
  }

  /** Internal (tests / bridges) — never serialize credentialReference to logs. */
  getPaymentAccountInternal(accountId: string): PaymentAccount {
    return this.requireAccount(accountId);
  }

  private requireAccount(accountId: string): PaymentAccount {
    const account = this.store.accounts.get(accountId);
    if (!account) {
      throw new FinancialIdentityError(
        "PAYMENT_ACCOUNT_NOT_FOUND",
        `payment account not found: ${accountId}`,
      );
    }
    return account;
  }
}

function looksLikeRawToken(value: string): boolean {
  const v = value.trim();
  if (/^(TEST-|APP_USR-|APP_USR)/i.test(v)) return true;
  if (v.length > 40 && !v.includes(":") && !v.startsWith("vault:")) return true;
  return false;
}
