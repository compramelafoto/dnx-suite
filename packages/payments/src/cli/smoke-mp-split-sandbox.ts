#!/usr/bin/env node
/**
 * Sandbox-only Mercado Pago Split smoke CLI.
 *
 * Usage:
 *   pnpm --filter @repo/payments smoke:mp-split-sandbox -- --dry-run
 *   pnpm --filter @repo/payments smoke:mp-split-sandbox -- --confirm
 *
 * Never prints secrets. Blocks Production writes.
 */

import { resolve } from "node:path";
import {
  loadSandboxEnvFromProcess,
  runSandboxPreflight,
  type SandboxPreflightStatus,
} from "../sandbox/preflight.js";

function parseArgs(argv: string[]) {
  const confirm = argv.includes("--confirm");
  const dryRun = argv.includes("--dry-run") || !confirm;
  const cleanup = argv.includes("--cleanup");
  return { confirm, dryRun, cleanup };
}

function exitCodeFor(status: SandboxPreflightStatus): number {
  switch (status) {
    case "READY":
      return 0;
    case "CONFIRMATION_REQUIRED":
      return 2;
    case "MISSING_TEST_TOKEN":
    case "INVALID_TEST_OWNER":
    case "INVALID_TEST_PARTNER":
    case "BLOCKED_BY_TEST_PARTNER_EMAIL":
    case "PRODUCTION_TOKEN_REJECTED":
    case "BLOCKED_BY_SANDBOX_CREDENTIALS":
    case "BLOCKED_BY_TEST_PAYMENT_TOKEN":
      return 3;
    default:
      return 1;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Resolve monorepo root when launched via pnpm filter from packages/payments.
  const repoRoot = resolve(process.cwd(), "../..");
  const envInput = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });
  const preflight = runSandboxPreflight({
    ...envInput,
    confirm: args.confirm,
    dryRun: args.dryRun,
    requirePaymentToken: !args.dryRun,
  });

  const correlationId = crypto.randomUUID();
  const report = {
    stage: "05A",
    command: "smoke:mp-split-sandbox",
    correlationId,
    dryRun: args.dryRun,
    cleanupRequested: args.cleanup,
    preflightStatus: preflight.status,
    checks: preflight.checks,
    credentialAudit: preflight.credentialAudit,
    hints: preflight.hints,
    productionWritesAllowed: false,
    blockA:
      preflight.status === "READY" && !args.dryRun
        ? "READY_TO_EXECUTE"
        : preflight.status === "READY" && args.dryRun
          ? "DRY_RUN_ONLY"
          : preflight.status,
    waitingMpConfirmation: [
      "fee_allocation",
      "owner_definitive",
      "taxes_withholdings",
      "settlements",
      "payouts",
      "chargebacks_after_withdrawal",
    ],
  };

  console.log(JSON.stringify(report, null, 2));

  if (preflight.status !== "READY") {
    process.exitCode = exitCodeFor(preflight.status);
    return;
  }

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          message: "Dry-run OK. No Mercado Pago writes executed.",
          next: "Re-run with --confirm once TEST payment token + device id are set.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 0;
    return;
  }

  if (!envInput.paymentToken || !envInput.deviceId) {
    console.log(
      JSON.stringify(
        {
          blockA: "BLOCKED_BY_TEST_PAYMENT_TOKEN",
          message:
            "Obtain card token via MercadoPago.js + TEST public key in browser; set MERCADOPAGO_TEST_PAYMENT_TOKEN and MERCADOPAGO_TEST_DEVICE_ID.",
        },
        null,
        2,
      ),
    );
    process.exitCode = 4;
    return;
  }

  console.log(
    JSON.stringify(
      {
        blockA: "NOT_EXECUTED_IN_THIS_RUN",
        message:
          "Preflight READY with payment token present, but automated live order creation remains operator-confirmed via MCP tools.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 0;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : "unknown_error";
  console.error(JSON.stringify({ error: message, secretsPrinted: false }));
  process.exitCode = 1;
});
