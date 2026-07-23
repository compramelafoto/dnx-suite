/**
 * Prisma persistence for Economic Agreement graph + FinanceGrant (staging).
 */
import type { FinanceGrant } from "../../finance-permissions/types.js";
import type {
  FinancialDomainStore,
} from "../../financial-identity/memory-store.js";
import type {
  AgreementParticipant,
  DistributionRuleRecord,
  DistributionVersion,
  EconomicAgreement,
  OrderDistributionSnapshot,
} from "../../economic-agreement/types.js";

export interface StagingPartnerUserFixture {
  key: "dani" | "rodri" | "tammy" | "admin_nofinance";
  email: string;
  name: string;
  handler: string;
  classification: "USER_CONFIRMED" | "USER_FIXTURE_CREATED";
}

/** Canonical TEST fixture emails — never production. */
export const STAGING_PARTNER_FIXTURES: StagingPartnerUserFixture[] = [
  {
    key: "dani",
    email: "e10dani@clickaton.staging.test",
    name: "Dani Partner TEST",
    handler: "e10_dani_test",
    classification: "USER_FIXTURE_CREATED",
  },
  {
    key: "rodri",
    email: "e10rodri@clickaton.staging.test",
    name: "Rodri Partner TEST",
    handler: "e10_rodri_test",
    classification: "USER_FIXTURE_CREATED",
  },
  {
    key: "tammy",
    email: "e10tammy@clickaton.staging.test",
    name: "Tamara Partner TEST",
    handler: "e10_tammy_test",
    classification: "USER_FIXTURE_CREATED",
  },
  {
    key: "admin_nofinance",
    email: "e10admin@clickaton.staging.test",
    name: "Clickaton Admin No Finance TEST",
    handler: "e10_admin_nofinance_test",
    classification: "USER_FIXTURE_CREATED",
  },
];

export interface EconomicAgreementPrisma {
  user: {
    findUnique: (args: unknown) => Promise<{
      id: number;
      email: string;
      name: string | null;
      handler: string | null;
    } | null>;
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: number; email: string; name: string | null }>;
  };
  dnxFinanceGrant: {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        userId: number;
        capability: string;
        productKey: string | null;
        scopeType: string | null;
        scopeId: string | null;
        status: string;
        grantedByUserId: number | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxFinancialIdentity: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxPaymentAccount: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxEconomicAgreement: {
    findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  dnxAgreementParticipant: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  dnxDistributionVersion: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
    update: (args: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  dnxDistributionRule: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxOrderDistributionSnapshot: {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  dnxPaymentAuditEvent: {
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  };
}

export function sanitizeEmailReport(email: string): {
  prefix3: string;
  domain: string;
} {
  const [local = "", domain = ""] = email.split("@");
  return { prefix3: local.slice(0, 3), domain };
}

export async function ensureStagingPartnerUsers(
  prisma: EconomicAgreementPrisma,
): Promise<
  Array<{
    key: StagingPartnerUserFixture["key"];
    userId: number;
    classification: "USER_CONFIRMED" | "USER_FIXTURE_CREATED";
    emailSanitized: ReturnType<typeof sanitizeEmailReport>;
    name: string;
  }>
> {
  const out: Array<{
    key: StagingPartnerUserFixture["key"];
    userId: number;
    classification: "USER_CONFIRMED" | "USER_FIXTURE_CREATED";
    emailSanitized: ReturnType<typeof sanitizeEmailReport>;
    name: string;
  }> = [];

  for (const fixture of STAGING_PARTNER_FIXTURES) {
    const existing = await prisma.user.findUnique({
      where: { email: fixture.email },
      select: { id: true, email: true, name: true, handler: true },
    });
    if (existing) {
      out.push({
        key: fixture.key,
        userId: existing.id,
        classification: "USER_CONFIRMED",
        emailSanitized: sanitizeEmailReport(existing.email),
        name: existing.name ?? fixture.name,
      });
      continue;
    }
    const created = await prisma.user.create({
      data: {
        email: fixture.email,
        name: fixture.name,
        handler: fixture.handler,
        role: "PHOTOGRAPHER",
        globalRole: "USER",
        // No mp* fields — TEST fixtures without real MP.
      },
    });
    out.push({
      key: fixture.key,
      userId: created.id,
      classification: "USER_FIXTURE_CREATED",
      emailSanitized: sanitizeEmailReport(created.email),
      name: created.name ?? fixture.name,
    });
  }
  return out;
}

export async function ensureDaniFinanceOwnerGrant(
  prisma: EconomicAgreementPrisma,
  daniUserId: number,
): Promise<FinanceGrant> {
  const existing = await prisma.dnxFinanceGrant.findMany({
    where: {
      userId: daniUserId,
      capability: "DNX_FINANCE_OWNER",
      status: "ACTIVE",
    },
  });
  if (existing[0]) {
    return mapGrant(existing[0]);
  }
  const now = new Date();
  const id = `grant_e10_owner_${daniUserId}`;
  await prisma.dnxFinanceGrant.create({
    data: {
      id,
      userId: daniUserId,
      capability: "DNX_FINANCE_OWNER",
      productKey: "clickaton",
      scopeType: "STAGING_TEST",
      scopeId: "partners-10d3i-e",
      status: "ACTIVE",
      grantedByUserId: daniUserId,
      createdAt: now,
      updatedAt: now,
    },
  });
  return {
    id,
    userId: daniUserId,
    capability: "DNX_FINANCE_OWNER",
    productKey: "clickaton",
    scopeType: "STAGING_TEST",
    scopeId: "partners-10d3i-e",
    status: "ACTIVE",
    grantedByUserId: daniUserId,
    createdAt: now,
    updatedAt: now,
  };
}

function mapGrant(row: {
  id: string;
  userId: number;
  capability: string;
  productKey: string | null;
  scopeType: string | null;
  scopeId: string | null;
  status: string;
  grantedByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
}): FinanceGrant {
  return {
    id: row.id,
    userId: row.userId,
    capability: row.capability as FinanceGrant["capability"],
    productKey: row.productKey,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    status: row.status as FinanceGrant["status"],
    grantedByUserId: row.grantedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function loadFinanceGrants(
  prisma: EconomicAgreementPrisma,
  userIds: number[],
): Promise<Map<number, FinanceGrant[]>> {
  const rows = await prisma.dnxFinanceGrant.findMany({
    where: { userId: { in: userIds }, status: "ACTIVE" },
  });
  const map = new Map<number, FinanceGrant[]>();
  for (const row of rows) {
    const list = map.get(row.userId) ?? [];
    list.push(mapGrant(row));
    map.set(row.userId, list);
  }
  return map;
}

export async function hydrateAgreementGraphFromPrisma(
  prisma: EconomicAgreementPrisma,
  store: FinancialDomainStore,
): Promise<void> {
  const agreements = await prisma.dnxEconomicAgreement.findMany({ where: {} });
  for (const row of agreements) {
    const a: EconomicAgreement = {
      id: String(row.id),
      productKey: String(row.productKey),
      scopeType: String(row.scopeType),
      scopeId: String(row.scopeId),
      name: String(row.name),
      countryCode: String(row.countryCode),
      currency: String(row.currency),
      status: row.status as EconomicAgreement["status"],
      currentVersionId: (row.currentVersionId as string | null) ?? null,
      createdByUserId: Number(row.createdByUserId),
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    };
    store.agreements.set(a.id, a);
  }

  const participants = await prisma.dnxAgreementParticipant.findMany({
    where: {},
  });
  for (const row of participants) {
    const p: AgreementParticipant = {
      id: String(row.id),
      agreementId: String(row.agreementId),
      financialIdentityId: String(row.financialIdentityId),
      paymentAccountId: (row.paymentAccountId as string | null) ?? null,
      roleLabel: row.roleLabel as AgreementParticipant["roleLabel"],
      status: row.status as AgreementParticipant["status"],
      validFrom: row.validFrom ? new Date(String(row.validFrom)) : null,
      validTo: row.validTo ? new Date(String(row.validTo)) : null,
      invitedByUserId: Number(row.invitedByUserId),
      approvedByUserId:
        row.approvedByUserId != null ? Number(row.approvedByUserId) : null,
      acceptedAt: row.acceptedAt ? new Date(String(row.acceptedAt)) : null,
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt)),
    };
    store.participants.set(p.id, p);
  }

  const versions = await prisma.dnxDistributionVersion.findMany({ where: {} });
  for (const row of versions) {
    const v: DistributionVersion = {
      id: String(row.id),
      agreementId: String(row.agreementId),
      versionNumber: Number(row.versionNumber),
      status: row.status as DistributionVersion["status"],
      roundingPolicy: String(
        row.roundingPolicy,
      ) as DistributionVersion["roundingPolicy"],
      feePolicy: (row.feePolicy as string | null) ?? null,
      publishedAt: row.publishedAt ? new Date(String(row.publishedAt)) : null,
      publishedByUserId:
        row.publishedByUserId != null ? Number(row.publishedByUserId) : null,
      supersedesVersionId: (row.supersedesVersionId as string | null) ?? null,
      rulesHash: (row.rulesHash as string | null) ?? null,
      createdAt: new Date(String(row.createdAt)),
    };
    store.versions.set(v.id, v);
  }

  const rules = await prisma.dnxDistributionRule.findMany({ where: {} });
  for (const row of rules) {
    const r: DistributionRuleRecord = {
      id: String(row.id),
      distributionVersionId: String(row.distributionVersionId),
      agreementParticipantId: String(row.agreementParticipantId),
      kind: row.kind as DistributionRuleRecord["kind"],
      value: BigInt(String(row.value)),
      priority: Number(row.priority),
      optional: Boolean(row.optional),
      createdAt: new Date(String(row.createdAt)),
    };
    store.rules.set(r.id, r);
  }

  const snapshots = await prisma.dnxOrderDistributionSnapshot.findMany({
    where: {},
  });
  for (const row of snapshots) {
    const s: OrderDistributionSnapshot = {
      id: String(row.id),
      schemaVersion: 1,
      agreementId: String(row.agreementId),
      distributionVersionId: String(row.distributionVersionId),
      versionNumber: Number(row.versionNumber),
      productKey: String(row.productKey),
      scopeType: String(row.scopeType),
      scopeId: String(row.scopeId),
      currency: String(row.currency),
      totalMinor: BigInt(String(row.totalMinor)),
      payload: row.payload as OrderDistributionSnapshot["payload"],
      engineInputHash: String(row.engineInputHash),
      publishedByUserId:
        row.publishedByUserId != null ? Number(row.publishedByUserId) : null,
      publishedAt: row.publishedAt ? new Date(String(row.publishedAt)) : null,
      paymentIntentId: (row.paymentIntentId as string | null) ?? null,
      paymentOrderId: (row.paymentOrderId as string | null) ?? null,
      externalReference: (row.externalReference as string | null) ?? null,
      createdAt: new Date(String(row.createdAt)),
    };
    store.snapshots.set(s.id, s);
  }
}

export async function persistEconomicAgreementGraphDelta(
  prisma: EconomicAgreementPrisma,
  store: FinancialDomainStore,
  prior: {
    agreementIds: Set<string>;
    participantIds: Set<string>;
    versionIds: Set<string>;
    ruleIds: Set<string>;
    snapshotIds: Set<string>;
  },
): Promise<{
  agreements: number;
  participants: number;
  versions: number;
  rules: number;
  snapshots: number;
}> {
  let agreements = 0;
  let participants = 0;
  let versions = 0;
  let rules = 0;
  let snapshots = 0;

  // 1) Agreements without currentVersionId first
  for (const [id, a] of store.agreements) {
    if (prior.agreementIds.has(id)) continue;
    await prisma.dnxEconomicAgreement.create({
      data: {
        id: a.id,
        productKey: a.productKey,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        name: a.name,
        countryCode: a.countryCode,
        currency: a.currency,
        status: a.status,
        currentVersionId: null,
        createdByUserId: a.createdByUserId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      },
    });
    agreements += 1;
  }

  for (const [id, p] of store.participants) {
    if (prior.participantIds.has(id)) continue;
    await prisma.dnxAgreementParticipant.create({
      data: {
        id: p.id,
        agreementId: p.agreementId,
        financialIdentityId: p.financialIdentityId,
        paymentAccountId: p.paymentAccountId,
        roleLabel: p.roleLabel,
        status: p.status,
        validFrom: p.validFrom,
        validTo: p.validTo,
        invitedByUserId: p.invitedByUserId,
        approvedByUserId: p.approvedByUserId,
        acceptedAt: p.acceptedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
    });
    participants += 1;
  }

  for (const [id, v] of store.versions) {
    if (prior.versionIds.has(id)) continue;
    await prisma.dnxDistributionVersion.create({
      data: {
        id: v.id,
        agreementId: v.agreementId,
        versionNumber: v.versionNumber,
        status: v.status,
        roundingPolicy: v.roundingPolicy,
        feePolicy: v.feePolicy,
        publishedAt: v.publishedAt,
        publishedByUserId: v.publishedByUserId,
        supersedesVersionId: v.supersedesVersionId,
        rulesHash: v.rulesHash,
        createdAt: v.createdAt,
      },
    });
    versions += 1;
  }

  for (const [id, r] of store.rules) {
    if (prior.ruleIds.has(id)) continue;
    await prisma.dnxDistributionRule.create({
      data: {
        id: r.id,
        distributionVersionId: r.distributionVersionId,
        agreementParticipantId: r.agreementParticipantId,
        kind: r.kind,
        value: r.value,
        priority: r.priority,
        optional: r.optional,
        createdAt: r.createdAt,
      },
    });
    rules += 1;
  }

  // Update agreement currentVersion + status for all agreements in store
  for (const a of store.agreements.values()) {
    await prisma.dnxEconomicAgreement.update({
      where: { id: a.id },
      data: {
        status: a.status,
        currentVersionId: a.currentVersionId,
        updatedAt: a.updatedAt,
      },
    });
  }

  // Sync participant status/account if previously existed
  for (const p of store.participants.values()) {
    if (!prior.participantIds.has(p.id)) continue;
    await prisma.dnxAgreementParticipant.update({
      where: { id: p.id },
      data: {
        paymentAccountId: p.paymentAccountId,
        status: p.status,
        acceptedAt: p.acceptedAt,
        updatedAt: p.updatedAt,
      },
    });
  }

  for (const v of store.versions.values()) {
    if (!prior.versionIds.has(v.id)) continue;
    await prisma.dnxDistributionVersion.update({
      where: { id: v.id },
      data: {
        status: v.status,
        publishedAt: v.publishedAt,
        publishedByUserId: v.publishedByUserId,
        rulesHash: v.rulesHash,
        supersedesVersionId: v.supersedesVersionId,
      },
    });
  }

  for (const [id, s] of store.snapshots) {
    if (prior.snapshotIds.has(id)) continue;
    await prisma.dnxOrderDistributionSnapshot.create({
      data: {
        id: s.id,
        schemaVersion: s.schemaVersion,
        agreementId: s.agreementId,
        distributionVersionId: s.distributionVersionId,
        versionNumber: s.versionNumber,
        productKey: s.productKey,
        scopeType: s.scopeType,
        scopeId: s.scopeId,
        currency: s.currency,
        totalMinor: s.totalMinor,
        payload: s.payload,
        engineInputHash: s.engineInputHash,
        publishedByUserId: s.publishedByUserId,
        publishedAt: s.publishedAt,
        paymentIntentId: s.paymentIntentId,
        paymentOrderId: s.paymentOrderId,
        externalReference: s.externalReference,
        createdAt: s.createdAt,
      },
    });
    snapshots += 1;
  }

  return { agreements, participants, versions, rules, snapshots };
}
