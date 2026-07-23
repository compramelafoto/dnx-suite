#!/usr/bin/env node
/**
 * 10D3I-E — Configure Clickatón partners economic agreement on staging.
 *
 * Requires:
 *   --remote --confirm-staging --apply
 *   DATABASE_URL / DIRECT_URL → ep-divine-smoke-av8hmt7s* / clickaton_staging
 *
 * Never prints tokens, full emails, or credential ciphertext.
 * Never calls Mercado Pago Orders API.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildOrders1nDryRun } from "../bridges/orders-1n-dry-run.js";
import {
  CLICKATON_PARTNERS_AGREEMENT,
  CLICKATON_PARTNERS_BPS,
  CLICKATON_PARTNERS_MP_IDS,
  configureClickatonPartnersAgreement,
} from "../economic-agreement/configure-clickaton-partners.js";
import {
  createFinancialDomainStore,
  FinancialIdentityService,
} from "../financial-identity/index.js";
import { EconomicAgreementService } from "../economic-agreement/service.js";
import {
  ensureDaniFinanceOwnerGrant,
  ensureStagingPartnerUsers,
  hydrateAgreementGraphFromPrisma,
  loadFinanceGrants,
  persistEconomicAgreementGraphDelta,
  type EconomicAgreementPrisma,
} from "../infrastructure/prisma/economic-agreement-remote.js";
import {
  hydrateFinancialStoreFromPrisma,
  persistFinancialStoreDelta,
  type LegacyMpBackfillPrisma,
} from "../infrastructure/prisma/legacy-mp-backfill-remote.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";

type Args = {
  apply: boolean;
  remote: boolean;
  confirmStaging: boolean;
  reportDir: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    apply: false,
    remote: false,
    confirmStaging: false,
    reportDir: ".local/audit-10d3i-e",
  };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    if (a === "--remote") args.remote = true;
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a.startsWith("--report-dir=")) {
      args.reportDir = a.slice("--report-dir=".length);
    }
  }
  return args;
}

function redactHost(host: string): string {
  if (host.length <= 24) return `${host.slice(0, 12)}*`;
  return `${host.slice(0, 24)}*`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.remote || !args.confirmStaging) {
    throw new Error(
      "Requires --remote --confirm-staging (and --apply to persist)",
    );
  }

  const gate = assertFinancialIdentityStagingHost();
  const readMode = process.env.DNX_FINANCIAL_IDENTITY_READ_MODE ?? "LEGACY_ONLY";
  const writeEnabled =
    process.env.DNX_FINANCIAL_IDENTITY_WRITE_ENABLED === "true";
  const backfillEnabled =
    process.env.DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED === "true";
  const fiOnly =
    process.env.DNX_FINANCIAL_IDENTITY_ONLY === "true" ||
    process.env.FINANCIAL_IDENTITY_ONLY === "true";

  if (readMode !== "LEGACY_ONLY") {
    throw new Error(
      `ABORT: expected DNX_FINANCIAL_IDENTITY_READ_MODE=LEGACY_ONLY (got ${readMode})`,
    );
  }
  if (fiOnly) {
    throw new Error("ABORT: FINANCIAL_IDENTITY_ONLY must remain off");
  }

  const prisma = new PrismaClient();
  try {
    const dbRow = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      `SELECT current_database() AS db`,
    );
    const db = dbRow[0]?.db ?? "";
    if (db !== "clickaton_staging") {
      throw new Error(`ABORT: unexpected database ${db}`);
    }
    const mig = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT count(*)::int AS c FROM "_prisma_migrations"`,
    );
    const migCount = mig[0]?.c ?? 0;

    const users = await ensureStagingPartnerUsers(
      prisma as unknown as EconomicAgreementPrisma,
    );
    const byKey = Object.fromEntries(users.map((u) => [u.key, u])) as Record<
      string,
      (typeof users)[number]
    >;
    const dani = byKey.dani!;
    const rodri = byKey.rodri!;
    const tammy = byKey.tammy!;

    await ensureDaniFinanceOwnerGrant(
      prisma as unknown as EconomicAgreementPrisma,
      dani.userId,
    );

    const store = createFinancialDomainStore();
    await hydrateFinancialStoreFromPrisma(
      prisma as unknown as LegacyMpBackfillPrisma,
      store,
    );
    await hydrateAgreementGraphFromPrisma(
      prisma as unknown as EconomicAgreementPrisma,
      store,
    );

    const priorIdentityIds = new Set(store.identities.keys());
    const priorAccountIds = new Set(store.accounts.keys());
    const priorAuditCount = store.audit.length;
    const priorAgreement = {
      agreementIds: new Set(store.agreements.keys()),
      participantIds: new Set(store.participants.keys()),
      versionIds: new Set(store.versions.keys()),
      ruleIds: new Set(store.rules.keys()),
      snapshotIds: new Set(store.snapshots.keys()),
    };

    const grantsByUserId = await loadFinanceGrants(
      prisma as unknown as EconomicAgreementPrisma,
      [dani.userId, rodri.userId, tammy.userId],
    );

    const identities = new FinancialIdentityService(store);
    const agreements = new EconomicAgreementService(store);

    const configured = configureClickatonPartnersAgreement({
      store,
      identities,
      agreements,
      partners: {
        dani: {
          key: "dani",
          userId: dani.userId,
          legalName: dani.name,
        },
        rodri: {
          key: "rodri",
          userId: rodri.userId,
          legalName: rodri.name,
        },
        tammy: {
          key: "tammy",
          userId: tammy.userId,
          legalName: tammy.name,
        },
      },
      grantsByUserId,
      totalMinorForSnapshot: 100_000n,
      externalReference: "clickaton-10d3i-e-sim-order-100000",
    });

    const rules = [...store.rules.values()].filter(
      (r) => r.distributionVersionId === configured.published.id,
    );
    const dryRun = buildOrders1nDryRun({
      agreement: configured.agreement,
      version: configured.published,
      rules,
      participants: [
        configured.participants.dani,
        configured.participants.rodri,
        configured.participants.tammy,
      ],
      accountsById: store.accounts,
      totalMinor: 100_000n,
      ownerParticipantId: configured.participants.dani.id,
      testReceiverIdsByParticipantId: new Map([
        [configured.participants.dani.id, CLICKATON_PARTNERS_MP_IDS.dani],
        [configured.participants.rodri.id, CLICKATON_PARTNERS_MP_IDS.rodri],
        [configured.participants.tammy.id, CLICKATON_PARTNERS_MP_IDS.tammy],
      ]),
      externalReference: "clickaton-10d3i-e-orders-dry-run",
    });

    let persistResult = {
      identitiesCreated: 0,
      accountsCreated: 0,
      auditsCreated: 0,
      agreements: 0,
      participants: 0,
      versions: 0,
      rules: 0,
      snapshots: 0,
    };

    if (args.apply) {
      const fiDelta = await persistFinancialStoreDelta(
        prisma as unknown as LegacyMpBackfillPrisma,
        store,
        priorIdentityIds,
        priorAccountIds,
        priorAuditCount,
      );
      const agrDelta = await persistEconomicAgreementGraphDelta(
        prisma as unknown as EconomicAgreementPrisma,
        store,
        priorAgreement,
      );
      persistResult = { ...fiDelta, ...agrDelta };
    }

    // Immutability probe (in-memory only)
    let immutability = "OK";
    try {
      // @ts-expect-error intentional mutate attempt
      configured.snapshot.payload.participants[0].shareBps = 1;
      immutability = "MUTATED_UNEXPECTEDLY";
    } catch {
      immutability = "FROZEN_OK";
    }
    if (
      configured.snapshot.payload.participants[0]?.shareBps ===
      CLICKATON_PARTNERS_BPS.dani
    ) {
      immutability = "FROZEN_OK";
    }

    const report = {
      stage: "10D3I-E",
      host: redactHost(gate.host),
      database: db,
      migrations: migCount,
      apply: args.apply,
      alreadyConfigured: configured.alreadyConfigured,
      users: users.map((u) => ({
        key: u.key,
        userId: u.userId,
        classification: u.classification,
        email: u.emailSanitized,
        name: u.name,
      })),
      grants: {
        dani: "DNX_FINANCE_OWNER",
        rodri: "PARTICIPANT_SELF (ownership)",
        tammy: "PARTICIPANT_SELF (ownership)",
      },
      agreement: {
        idPrefix: configured.agreement.id.slice(0, 10),
        productKey: configured.agreement.productKey,
        scopeType: configured.agreement.scopeType,
        scopeId: configured.agreement.scopeId,
        name: configured.agreement.name,
        status: configured.agreement.status,
      },
      version: {
        number: configured.published.versionNumber,
        status: configured.published.status,
        rulesHashPrefix: configured.published.rulesHash?.slice(0, 12) ?? null,
      },
      rulesBps: CLICKATON_PARTNERS_BPS,
      totalBps: configured.bridge.totalBps,
      snapshotAmounts: {
        dani: configured.amounts.dani.toString(),
        rodri: configured.amounts.rodri.toString(),
        tammy: configured.amounts.tammy.toString(),
        total: configured.amounts.total.toString(),
      },
      permissionProbes: configured.permissionProbes,
      orders1n: {
        mock: dryRun.mode,
        recipients: dryRun.recipients,
        realHttpCall: dryRun.realHttpCall,
        realOrders: "DISABLED",
      },
      immutability,
      persistResult,
      flags: {
        DNX_FINANCIAL_IDENTITY_READ_MODE: readMode,
        DNX_FINANCIAL_IDENTITY_WRITE_ENABLED: writeEnabled,
        DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED: backfillEnabled,
        FINANCIAL_IDENTITY_ONLY: fiOnly,
        ORDERS_1N: "DISABLED",
      },
      scope: CLICKATON_PARTNERS_AGREEMENT,
    };

    mkdirSync(args.reportDir, { recursive: true });
    const reportPath = join(args.reportDir, "configure_agreement_report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(
      JSON.stringify(
        {
          ok: true,
          reportPath,
          alreadyConfigured: configured.alreadyConfigured,
          totalBps: configured.bridge.totalBps,
          snapshotTotal: configured.amounts.total.toString(),
          orders: "SIMULATED_NOT_SENT",
          ordersReal: "DISABLED",
          apply: args.apply,
          persistResult,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
