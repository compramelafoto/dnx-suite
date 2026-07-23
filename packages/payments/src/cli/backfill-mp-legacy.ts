#!/usr/bin/env node
/**
 * Legacy MP → FinancialIdentity backfill.
 * Default: --dry-run (never writes).
 *
 * Remote --apply requires:
 *   --remote
 *   --confirm-staging
 *   DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true
 *   host fingerprint ep-divine-smoke-av8hmt7s* (or ep-round-fog*)
 *
 * Never prints tokens.
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  createMemoryCredentialStore,
  UNIT_TEST_MASTER_KEY_BASE64,
} from "../credential-vault/index.js";
import { createFinancialDomainStore } from "../financial-identity/index.js";
import {
  runLegacyMpBackfill,
  type BackfillSummary,
} from "../legacy/clf/backfill.js";
import type { LegacyLabMpRow, LegacyUserMpRow } from "../dual-read/types.js";
import type { FinancialEnvironment } from "../financial-identity/types.js";
import { createPrismaCredentialStore } from "../infrastructure/prisma/credential-store.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";
import {
  hydrateFinancialStoreFromPrisma,
  loadLegacyMpRowsFromPrisma,
  persistFinancialStoreDelta,
  type LegacyMpBackfillPrisma,
} from "../infrastructure/prisma/legacy-mp-backfill-remote.js";

type Args = {
  dryRun: boolean;
  apply: boolean;
  environment: FinancialEnvironment;
  source: "user" | "lab" | "all";
  userId?: number;
  limit?: number;
  reportFile?: string;
  confirmStaging: boolean;
  fixture: boolean;
  remote: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: true,
    apply: false,
    environment: "TEST",
    source: "all",
    confirmStaging: false,
    fixture: false,
    remote: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") args.dryRun = true;
    if (a === "--apply") {
      args.apply = true;
      args.dryRun = false;
    }
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a === "--fixture") args.fixture = true;
    if (a === "--remote") args.remote = true;
    if (a.startsWith("--environment=")) {
      const v = a.slice("--environment=".length).toLowerCase();
      args.environment = v === "prod" ? "PROD" : "TEST";
    }
    if (a.startsWith("--source=")) {
      const v = a.slice("--source=".length);
      if (v === "user" || v === "lab" || v === "all") args.source = v;
    }
    if (a.startsWith("--user-id=")) {
      args.userId = Number(a.slice("--user-id=".length));
    }
    if (a.startsWith("--limit=")) {
      args.limit = Number(a.slice("--limit=".length));
    }
    if (a.startsWith("--report-file=")) {
      args.reportFile = a.slice("--report-file=".length);
    }
  }
  return args;
}

function assertStagingGate(args: Args): void {
  if (!args.apply && !args.remote) return;
  if (args.fixture && !args.remote) return;

  if (args.apply) {
    if (process.env.DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED !== "true") {
      throw new Error(
        "APPLY_BLOCKED: set DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true",
      );
    }
    if (!args.confirmStaging) {
      throw new Error("APPLY_BLOCKED: pass --confirm-staging");
    }
  }

  if (args.remote || args.apply) {
    assertFinancialIdentityStagingHost();
  }

  if (args.environment === "PROD" && !args.fixture) {
    throw new Error("APPLY_BLOCKED: PROD backfill not authorized");
  }
}

function fixtureRows(): { users: LegacyUserMpRow[]; labs: LegacyLabMpRow[] } {
  return {
    users: [
      {
        userId: 91001,
        mpUserId: "TEST_FIXTURE_USER_A",
        mpAccessToken: "TEST-fixture-access-token-aaaa",
        mpRefreshToken: "TEST-fixture-refresh-token-aaaa",
        mpConnectedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        userId: 91002,
        mpUserId: null,
        mpAccessToken: "TEST-incomplete",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
      {
        userId: 91003,
        mpUserId: "TEST_FIXTURE_USER_A",
        mpAccessToken: "TEST-fixture-access-token-bbbb",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
    ],
    labs: [
      {
        labId: 71001,
        ownerUserId: 91001,
        name: "Lab Fixture Org",
        country: "Argentina",
        mpUserId: "TEST_FIXTURE_LAB_A",
        mpAccessToken: "TEST-fixture-lab-access-token",
        mpRefreshToken: null,
        mpConnectedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        labId: 71002,
        ownerUserId: null,
        name: "Lab No Owner",
        country: "Argentina",
        mpUserId: "TEST_FIXTURE_LAB_B",
        mpAccessToken: "TEST-fixture-lab-b",
        mpRefreshToken: null,
        mpConnectedAt: null,
      },
    ],
  };
}

function sanitizeReport(summary: BackfillSummary): unknown {
  return {
    dryRun: summary.dryRun,
    environment: summary.environment,
    written: summary.written,
    counts: summary.counts,
    rows: summary.rows.map((r) => ({
      sourceType: r.sourceType,
      legacyRecordId: r.legacyRecordId,
      classification: r.classification,
      reason: r.reason,
      actionProposed: r.actionProposed,
      mpUserIdSanitized: r.mpUserIdSanitized,
      destinationIdentityId: r.destinationIdentityId
        ? `${r.destinationIdentityId.slice(0, 10)}*`
        : null,
      destinationAccountId: r.destinationAccountId
        ? `${r.destinationAccountId.slice(0, 10)}*`
        : null,
    })),
  };
}

async function runRemote(args: Args): Promise<BackfillSummary> {
  const gate = assertFinancialIdentityStagingHost();
  if (!process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST) {
    throw new Error(
      "VAULT_BLOCKED: DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST required for remote",
    );
  }

  const prisma = new PrismaClient();
  const prismaFi = prisma as unknown as LegacyMpBackfillPrisma;
  try {
    const { users, labs } = await loadLegacyMpRowsFromPrisma(prismaFi, {
      userId: args.userId,
    });
    const store = createFinancialDomainStore();
    await hydrateFinancialStoreFromPrisma(prismaFi, store);
    const priorIdentityIds = new Set(store.identities.keys());
    const priorAccountIds = new Set(store.accounts.keys());
    const priorAuditCount = store.audit.length;

    const credentialStore = createPrismaCredentialStore(
      prisma as unknown as import("../infrastructure/prisma/credential-store.js").EncryptedCredentialPrismaDelegate,
    );

    const summary = await runLegacyMpBackfill({
      store,
      credentialStore,
      users,
      labs,
      environment: args.environment,
      dryRun: args.dryRun,
      source: args.source,
      limit: args.limit,
    });

    if (!args.dryRun && summary.written > 0) {
      const persisted = await persistFinancialStoreDelta(
        prismaFi,
        store,
        priorIdentityIds,
        priorAccountIds,
        priorAuditCount,
      );
      (summary as BackfillSummary & { persisted?: unknown }).persisted = {
        hostPrefix: gate.host.slice(0, 28),
        database: gate.database,
        ...persisted,
      };
    } else {
      (summary as BackfillSummary & { staging?: unknown }).staging = {
        hostPrefix: gate.host.slice(0, 28),
        database: gate.database,
        loadedUsers: users.length,
        loadedLabs: labs.length,
      };
    }

    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

async function runFixture(args: Args): Promise<BackfillSummary> {
  if (!process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST) {
    process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST =
      UNIT_TEST_MASTER_KEY_BASE64;
  }

  const { users, labs } = fixtureRows();
  const filteredUsers = args.userId
    ? users.filter((u) => u.userId === args.userId)
    : users;

  const store = createFinancialDomainStore();
  const credentialStore = createMemoryCredentialStore();
  const summary = await runLegacyMpBackfill({
    store,
    credentialStore,
    users: filteredUsers,
    labs,
    environment: args.environment,
    dryRun: args.dryRun,
    source: args.source,
    limit: args.limit,
  });

  if (!args.dryRun) {
    const again = await runLegacyMpBackfill({
      store,
      credentialStore,
      users: filteredUsers,
      labs,
      environment: args.environment,
      dryRun: true,
      source: args.source,
    });
    summary.counts.ALREADY_MIGRATED += again.counts.ALREADY_MIGRATED;
  }

  return summary;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertStagingGate(args);

  if (!args.fixture && !args.remote) {
    console.error(
      JSON.stringify({
        status: "MODE_REQUIRED",
        note: "Pass --remote (staging DB) or --fixture (local memory).",
        dryRun: args.dryRun,
      }),
    );
    process.exit(2);
  }

  if (args.remote && args.fixture) {
    throw new Error("MODE_CONFLICT: use --remote or --fixture, not both");
  }

  const summary = args.remote
    ? await runRemote(args)
    : await runFixture(args);

  emit(summary, args.reportFile);
}

function emit(summary: BackfillSummary, reportFile?: string): void {
  const payload = sanitizeReport(summary);
  const text = JSON.stringify(payload, null, 2);
  if (reportFile) {
    writeFileSync(reportFile, text, "utf8");
  }
  console.log(text);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
