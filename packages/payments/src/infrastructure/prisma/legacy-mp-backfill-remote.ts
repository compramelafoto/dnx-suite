import type { LegacyLabMpRow, LegacyUserMpRow } from "../../dual-read/types.js";
import type {
  FinancialDomainStore,
  FinanceAuditEvent,
} from "../../financial-identity/memory-store.js";
import type {
  FinancialEnvironment,
  FinancialIdentity,
  PaymentAccount,
} from "../../financial-identity/types.js";

/** Minimal Prisma surface for remote legacy MP backfill. */
export interface LegacyMpBackfillPrisma {
  user: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: number;
        email: string | null;
        mpUserId: string | null;
        mpAccessToken: string | null;
        mpRefreshToken: string | null;
        mpConnectedAt: Date | null;
      }>
    >;
  };
  lab: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: number;
        userId: number | null;
        name: string;
        country: string | null;
        mpUserId: string | null;
        mpAccessToken: string | null;
        mpRefreshToken: string | null;
        mpConnectedAt: Date | null;
      }>
    >;
  };
  dnxFinancialIdentity: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        subjectType: string;
        ownerUserId: number | null;
        isPrimary: boolean;
        organizationRef: string | null;
        legalName: string | null;
        taxId: string | null;
        countryCode: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxPaymentAccount: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        financialIdentityId: string;
        provider: string;
        environment: string;
        providerUserId: string | null;
        externalReference: string | null;
        credentialReference: string | null;
        consentReference: string | null;
        originApp: string | null;
        legacySource: string | null;
        tokenFingerprint: string | null;
        connectedAt: Date | null;
        capabilities: string[];
        isPrimary: boolean;
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  dnxPaymentAuditEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export async function loadLegacyMpRowsFromPrisma(
  prisma: LegacyMpBackfillPrisma,
  options?: { userId?: number },
): Promise<{ users: LegacyUserMpRow[]; labs: LegacyLabMpRow[] }> {
  const users = await prisma.user.findMany({
    where: options?.userId
      ? { id: options.userId }
      : {
          OR: [
            { mpAccessToken: { not: null } },
            { mpUserId: { not: null } },
          ],
        },
    select: {
      id: true,
      email: true,
      mpUserId: true,
      mpAccessToken: true,
      mpRefreshToken: true,
      mpConnectedAt: true,
    },
    orderBy: { id: "asc" },
  });

  const labs = await prisma.lab.findMany({
    where: {
      OR: [
        { mpAccessToken: { not: null } },
        { mpUserId: { not: null } },
      ],
    },
    select: {
      id: true,
      userId: true,
      name: true,
      country: true,
      mpUserId: true,
      mpAccessToken: true,
      mpRefreshToken: true,
      mpConnectedAt: true,
    },
    orderBy: { id: "asc" },
  });

  return {
    users: users.map((u) => ({
      userId: u.id,
      mpUserId: u.mpUserId,
      mpAccessToken: u.mpAccessToken,
      mpRefreshToken: u.mpRefreshToken,
      mpConnectedAt: u.mpConnectedAt,
    })),
    labs: labs.map((l) => ({
      labId: l.id,
      ownerUserId: l.userId,
      name: l.name,
      country: l.country,
      mpUserId: l.mpUserId,
      mpAccessToken: l.mpAccessToken,
      mpRefreshToken: l.mpRefreshToken,
      mpConnectedAt: l.mpConnectedAt,
    })),
  };
}

export async function hydrateFinancialStoreFromPrisma(
  prisma: LegacyMpBackfillPrisma,
  store: FinancialDomainStore,
): Promise<void> {
  const identities = await prisma.dnxFinancialIdentity.findMany({
    where: {},
    select: {
      id: true,
      subjectType: true,
      ownerUserId: true,
      isPrimary: true,
      organizationRef: true,
      legalName: true,
      taxId: true,
      countryCode: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  for (const row of identities) {
    const identity: FinancialIdentity = {
      id: row.id,
      subjectType: row.subjectType as FinancialIdentity["subjectType"],
      ownerUserId: row.ownerUserId,
      isPrimary: row.isPrimary,
      organizationRef: row.organizationRef,
      legalName: row.legalName,
      taxId: row.taxId,
      countryCode: row.countryCode,
      status: row.status as FinancialIdentity["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    store.identities.set(identity.id, identity);
  }

  const accounts = await prisma.dnxPaymentAccount.findMany({
    where: {},
    select: {
      id: true,
      financialIdentityId: true,
      provider: true,
      environment: true,
      providerUserId: true,
      externalReference: true,
      credentialReference: true,
      consentReference: true,
      originApp: true,
      legacySource: true,
      tokenFingerprint: true,
      connectedAt: true,
      capabilities: true,
      isPrimary: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  for (const row of accounts) {
    const account: PaymentAccount = {
      id: row.id,
      financialIdentityId: row.financialIdentityId,
      provider: row.provider as PaymentAccount["provider"],
      environment: row.environment as FinancialEnvironment,
      providerUserId: row.providerUserId,
      externalReference: row.externalReference,
      credentialReference: row.credentialReference,
      consentReference: row.consentReference,
      originApp: row.originApp,
      legacySource: row.legacySource,
      tokenFingerprint: row.tokenFingerprint,
      connectedAt: row.connectedAt,
      capabilities: row.capabilities as PaymentAccount["capabilities"],
      isPrimary: row.isPrimary,
      status: row.status as PaymentAccount["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    store.accounts.set(account.id, account);
  }
}

export async function persistFinancialStoreDelta(
  prisma: LegacyMpBackfillPrisma,
  store: FinancialDomainStore,
  priorIdentityIds: Set<string>,
  priorAccountIds: Set<string>,
  priorAuditCount: number,
): Promise<{ identitiesCreated: number; accountsCreated: number; auditsCreated: number }> {
  let identitiesCreated = 0;
  let accountsCreated = 0;
  let auditsCreated = 0;

  for (const [id, identity] of store.identities) {
    if (priorIdentityIds.has(id)) continue;
    await prisma.dnxFinancialIdentity.create({
      data: {
        id: identity.id,
        subjectType: identity.subjectType,
        ownerUserId: identity.ownerUserId,
        isPrimary: identity.isPrimary,
        organizationRef: identity.organizationRef,
        legalName: identity.legalName,
        taxId: identity.taxId,
        countryCode: identity.countryCode,
        status: identity.status,
        createdAt: identity.createdAt,
        updatedAt: identity.updatedAt,
      },
    });
    identitiesCreated += 1;
  }

  for (const [id, account] of store.accounts) {
    if (priorAccountIds.has(id)) continue;
    await prisma.dnxPaymentAccount.create({
      data: {
        id: account.id,
        financialIdentityId: account.financialIdentityId,
        provider: account.provider,
        environment: account.environment,
        providerUserId: account.providerUserId,
        externalReference: account.externalReference,
        credentialReference: account.credentialReference,
        consentReference: account.consentReference,
        originApp: account.originApp,
        legacySource: account.legacySource,
        tokenFingerprint: account.tokenFingerprint,
        connectedAt: account.connectedAt,
        capabilities: account.capabilities,
        isPrimary: account.isPrimary,
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    });
    accountsCreated += 1;
  }

  // Persist only new audit events from this run.
  const newAudits = store.audit.slice(priorAuditCount);
  for (const event of newAudits) {
    await persistAuditEvent(prisma, event);
    auditsCreated += 1;
  }

  return { identitiesCreated, accountsCreated, auditsCreated };
}

export async function disablePaymentAccountRemote(
  prisma: LegacyMpBackfillPrisma,
  accountId: string,
  actorUserId: number | null,
  reason: string,
): Promise<void> {
  await prisma.dnxPaymentAccount.update({
    where: { id: accountId },
    data: { status: "DISABLED", updatedAt: new Date() },
  });
  await persistAuditEvent(prisma, {
    id: `aud_remote_${Date.now()}`,
    action: "PAYMENT_ACCOUNT_ROLLBACK_DISABLED",
    aggregateType: "PaymentAccount",
    aggregateId: accountId,
    actorUserId,
    result: "SUCCEEDED",
    metadata: { reason },
    createdAt: new Date(),
  });
}

async function persistAuditEvent(
  prisma: LegacyMpBackfillPrisma,
  event: FinanceAuditEvent,
): Promise<void> {
  await prisma.dnxPaymentAuditEvent.create({
    data: {
      id: event.id,
      actorType: event.actorUserId != null ? "USER" : "SYSTEM",
      actorReference:
        event.actorUserId != null ? String(event.actorUserId) : "system",
      action: event.action,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      provider: "MERCADOPAGO",
      // DnxPaymentAuditEvent uses SANDBOX|PRODUCTION (not FI TEST/PROD enums).
      environment: "SANDBOX",
      result: event.result,
      metadata: event.metadata ?? undefined,
      createdAt: event.createdAt,
    },
  });
}
