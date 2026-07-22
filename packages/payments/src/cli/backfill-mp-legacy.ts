#!/usr/bin/env node
/**
 * Legacy MP → FinancialIdentity backfill.
 * Default: --dry-run (never writes).
 *
 * Remote --apply requires:
 *   --confirm-staging
 *   DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true
 *   host fingerprint ep-round-fog* (documented DNX Payments staging)
 *
 * Never prints tokens.
 */
import { writeFileSync } from "node:fs";
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
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: true,
    apply: false,
    environment: "TEST",
    source: "all",
    confirmStaging: false,
    fixture: false,
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
  if (!args.apply) return;
  if (!args.fixture) {
    // Remote apply path: require explicit staging confirmation + flag + host gate.
    if (process.env.DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED !== "true") {
      throw new Error(
        "APPLY_BLOCKED: set DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED=true",
      );
    }
    if (!args.confirmStaging) {
      throw new Error("APPLY_BLOCKED: pass --confirm-staging");
    }
    const url = process.env.DATABASE_URL ?? "";
    const hostMatch = url.match(/@([^/]+)\//);
    const host = hostMatch?.[1] ?? "";
    if (!host.startsWith("ep-round-fog") || !host.includes("neon.tech")) {
      throw new Error(
        `APPLY_BLOCKED: expected documented staging host ep-round-fog*, got prefix=${host.slice(0, 24) || "missing"}`,
      );
    }
  }
  // Never allow PROD apply via this CLI in 10D3I-D.
  if (args.environment === "PROD" && !args.fixture) {
    throw new Error("APPLY_BLOCKED: PROD backfill not authorized in 10D3I-D");
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertStagingGate(args);

  // Ensure TEST vault key for fixture runs.
  if (args.fixture && !process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST) {
    process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST =
      UNIT_TEST_MASTER_KEY_BASE64;
  }

  if (!args.fixture) {
    console.error(
      JSON.stringify({
        status: "DRY_RUN_OR_APPLY_REQUIRES_FIXTURE_OR_PRISMA_LOADER",
        note: "10D3I-D CLI ships fixture mode for local validation. Remote DB loaders require confirmed staging + authorized apply.",
        dryRun: args.dryRun,
      }),
    );
    if (!args.dryRun) {
      process.exit(2);
    }
    // dry-run without fixture → empty report (safe)
    const empty: BackfillSummary = {
      dryRun: true,
      environment: args.environment,
      rows: [],
      counts: {
        ELIGIBLE: 0,
        ALREADY_MIGRATED: 0,
        CONFLICT_PROVIDER_ID: 0,
        CONFLICT_IDENTITY: 0,
        INCOMPLETE: 0,
        ENVIRONMENT_UNKNOWN: 0,
        REVIEW_REQUIRED: 0,
        SKIPPED: 0,
      },
      written: 0,
    };
    emit(empty, args.reportFile);
    return;
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

  // Second pass idempotency check when applying fixtures.
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

  emit(summary, args.reportFile);
}

function emit(summary: BackfillSummary, reportFile?: string): void {
  const payload = {
    dryRun: summary.dryRun,
    environment: summary.environment,
    written: summary.written,
    counts: summary.counts,
    rows: summary.rows,
  };
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
