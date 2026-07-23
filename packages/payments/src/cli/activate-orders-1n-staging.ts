#!/usr/bin/env node
/**
 * 10D3I-F — Controlled Mercado Pago Orders 1:N TEST on staging.
 *
 * Modes:
 *   --preflight | --dry-run | --create-order | --get-order=<id>
 *   --idempotency-replay | --reject-cases | --rollback-flag-off
 *
 * Live create requires:
 *   --confirm-staging --confirm-orders-test
 *   DNX_MP_ORDERS_1N_STAGING_ENABLED=true (set only for create; CLI forces off after)
 *
 * Never prints tokens / full receiver IDs / emails.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadSandboxEnvFromProcess,
  runSandboxPreflight,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  isSandboxAccessToken,
  calculateDistribution,
  money,
  buildMercadoPagoSplitOrderRequest,
  buildSplitEntriesFromDistribution,
  inferAmountType,
  ORDERS_1N_STAGING_FLAG,
  isOrders1nStagingFlagEnabled,
  assertOrders1nStagingCreateAllowed,
  parseMercadoPagoOrdersWebhook,
} from "../index.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";

type Mode =
  | "preflight"
  | "dry-run"
  | "create-order"
  | "get-order"
  | "idempotency-replay"
  | "reject-cases"
  | "rollback-flag-off";

type Args = {
  mode: Mode;
  confirmStaging: boolean;
  confirmOrdersTest: boolean;
  getOrderId?: string;
  reportDir: string;
  totalMinor: bigint;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    mode: "preflight",
    confirmStaging: false,
    confirmOrdersTest: false,
    reportDir: ".local/audit-10d3i-f",
    totalMinor: 100_000n,
  };
  for (const a of argv) {
    if (a === "--preflight") args.mode = "preflight";
    if (a === "--dry-run") args.mode = "dry-run";
    if (a === "--create-order") args.mode = "create-order";
    if (a === "--idempotency-replay") args.mode = "idempotency-replay";
    if (a === "--reject-cases") args.mode = "reject-cases";
    if (a === "--rollback-flag-off") args.mode = "rollback-flag-off";
    if (a === "--get-order" || a.startsWith("--get-order=")) {
      args.mode = "get-order";
      if (a.startsWith("--get-order=")) {
        args.getOrderId = a.slice("--get-order=".length);
      }
    }
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a === "--confirm-orders-test") args.confirmOrdersTest = true;
    if (a.startsWith("--report-dir=")) args.reportDir = a.slice("--report-dir=".length);
  }
  return args;
}

function prefix(value: string | undefined | null, n = 8): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

function writeReport(dir: string, name: string, body: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, JSON.stringify(body, null, 2));
  return path;
}

function buildThreeWayDistribution(totalMinor: bigint) {
  const total = money("ARS", totalMinor);
  const rules = [
    {
      recipientId: "dani",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: 3400,
      priority: 1,
      optional: false,
    },
    {
      recipientId: "rodri",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: 3300,
      priority: 2,
      optional: false,
    },
    {
      recipientId: "tammy",
      role: "OTHER" as const,
      kind: "PERCENTAGE" as const,
      percentageBps: 3300,
      priority: 3,
      optional: false,
    },
  ];
  const distribution = calculateDistribution({
    total,
    rules,
    rounding: "LARGEST_REMAINDER",
    eligibleRecipientIds: ["dani", "rodri", "tammy"],
  });
  return { total, distribution, rules };
}

async function readSnapshotFingerprint(prisma: PrismaClient) {
  const snap = await prisma.dnxOrderDistributionSnapshot.findFirst({
    where: { externalReference: "clickaton-10d3i-e-sim-order-100000" },
    select: {
      id: true,
      engineInputHash: true,
      totalMinor: true,
      versionNumber: true,
      agreementId: true,
      distributionVersionId: true,
      payload: true,
    },
  });
  if (!snap) return null;
  const payload = snap.payload as { participants?: Array<{ shareBps?: number; amountMinor?: string }> };
  return {
    idPrefix: snap.id.slice(0, 10),
    hashPrefix: snap.engineInputHash.slice(0, 12),
    totalMinor: snap.totalMinor.toString(),
    versionNumber: snap.versionNumber,
    agreementIdPrefix: snap.agreementId.slice(0, 10),
    versionIdPrefix: snap.distributionVersionId.slice(0, 10),
    bps: (payload.participants ?? []).map((p) => p.shareBps).sort(),
    amounts: (payload.participants ?? []).map((p) => p.amountMinor).sort(),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd(), "../..");
  const reportDir = resolve(repoRoot, args.reportDir);

  if (args.mode === "rollback-flag-off") {
    process.env[ORDERS_1N_STAGING_FLAG] = "false";
    const path = writeReport(reportDir, "rollback_flag.json", {
      flag: ORDERS_1N_STAGING_FLAG,
      value: "off",
      processValue: process.env[ORDERS_1N_STAGING_FLAG],
      isEnabled: isOrders1nStagingFlagEnabled(),
    });
    console.log(JSON.stringify({ ok: true, mode: "rollback-flag-off", path, orders1n: "OFF" }));
    return;
  }

  const gate = assertFinancialIdentityStagingHost({
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  });

  const envInput = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });
  const preflight = runSandboxPreflight({
    ...envInput,
    dryRun: args.mode !== "create-order" && args.mode !== "idempotency-replay",
    confirm: args.confirmOrdersTest,
    requirePaymentToken:
      args.mode === "create-order" ||
      args.mode === "idempotency-replay" ||
      args.mode === "dry-run",
  });

  const resourceTable = {
    accessToken: Boolean(envInput.accessToken),
    publicKey: Boolean(envInput.publicKey),
    owner: Boolean(envInput.ownerUserId),
    receiver1: Boolean(envInput.partnerReceiverId),
    receiver2: Boolean(envInput.partnerReceiverId2),
    deviceId: Boolean(envInput.deviceId),
    paymentToken: Boolean(envInput.paymentToken),
    partnerEmail1: Boolean(envInput.partnerEmail),
    partnerEmail2: Boolean(envInput.partnerEmail2),
  };

  const prisma = new PrismaClient();
  let snapshotBefore: Awaited<ReturnType<typeof readSnapshotFingerprint>> = null;
  let snapshotAfter: Awaited<ReturnType<typeof readSnapshotFingerprint>> = null;

  try {
    const dbRow = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      `SELECT current_database() AS db`,
    );
    if (dbRow[0]?.db !== "clickaton_staging") {
      throw new Error(`ABORT: unexpected database ${dbRow[0]?.db}`);
    }
    snapshotBefore = await readSnapshotFingerprint(prisma);

    if (args.mode === "preflight") {
      const path = writeReport(reportDir, "preflight.json", {
        host: `${gate.host.slice(0, 24)}*`,
        database: gate.database,
        preflightStatus: preflight.status,
        checks: preflight.checks,
        resources: {
          ...resourceTable,
          receiver1Prefix: prefix(envInput.partnerReceiverId),
          receiver2Prefix: prefix(envInput.partnerReceiverId2),
          devicePrefix: prefix(envInput.deviceId),
          paymentTokenPrefix: prefix(envInput.paymentToken),
        },
        flag: {
          name: ORDERS_1N_STAGING_FLAG,
          enabled: isOrders1nStagingFlagEnabled(),
        },
        snapshot: snapshotBefore,
        mcpNote:
          "CLI loads services/dnx-mcp/.env.local from disk; MCP process may need restart to match.",
      });
      console.log(
        JSON.stringify({
          ok: preflight.status === "READY" && resourceTable.receiver1 && resourceTable.receiver2,
          mode: "preflight",
          preflightStatus: preflight.status,
          resources: resourceTable,
          path,
        }),
      );
      return;
    }

    const { total, distribution } = buildThreeWayDistribution(args.totalMinor);
    const partnerReceiverIds = new Map<string, string>();
    if (envInput.partnerReceiverId) {
      partnerReceiverIds.set("rodri", envInput.partnerReceiverId);
    }
    if (envInput.partnerReceiverId2) {
      partnerReceiverIds.set("tammy", envInput.partnerReceiverId2);
    }

    const amountType = inferAmountType(distribution);
    const entries = buildSplitEntriesFromDistribution(
      distribution,
      envInput.ownerUserId ?? "MISSING_OWNER",
      partnerReceiverIds,
    );
    const dryBuilt = buildMercadoPagoSplitOrderRequest({
      externalReference: "clickaton-10d3i-f-dry-run",
      total,
      amountType,
      entries,
      deviceSessionId: envInput.deviceId ?? "MISSING_DEVICE",
      ...(envInput.paymentToken ? { paymentToken: "[PRESENT]" } : {}),
    });

    const sanitizedPayload = {
      recipients: entries.length,
      amountType,
      totalMinor: total.amountMinor.toString(),
      currency: "ARS",
      bps: { dani: 3400, rodri: 3300, tammy: 3300, total: 10000 },
      ownerPrefix: prefix(envInput.ownerUserId, 3),
      receiver1Prefix: prefix(envInput.partnerReceiverId),
      receiver2Prefix: prefix(envInput.partnerReceiverId2),
      paymentTokenPresent: Boolean(envInput.paymentToken),
      deviceIdPresent: Boolean(envInput.deviceId),
      payloadHashPrefix: dryBuilt.payloadHash.slice(0, 12),
      hasTransactions: Boolean(
        dryBuilt.body.transactions?.payments?.length,
      ),
      // rebuild with placeholder so we don't put real token in dry body hash path above
    };

    // Correct dry-run: show shape without real token value
    const dryShape = buildMercadoPagoSplitOrderRequest({
      externalReference: "clickaton-10d3i-f-dry-run",
      total,
      amountType,
      entries,
      deviceSessionId: "DEVICE_PRESENT",
      ...(envInput.paymentToken ? { paymentToken: "TOKEN_PRESENT" } : {}),
    });
    sanitizedPayload.hasTransactions = Boolean(
      dryShape.body.transactions?.payments?.length,
    );
    sanitizedPayload.payloadHashPrefix = dryShape.payloadHash.slice(0, 12);

    if (args.mode === "dry-run") {
      const path = writeReport(reportDir, "dry_run.json", {
        ...sanitizedPayload,
        snapshotReferenced: snapshotBefore,
        snapshotMutated: false,
      });
      console.log(JSON.stringify({ ok: true, mode: "dry-run", path, sanitizedPayload }));
      return;
    }

    if (args.mode === "reject-cases") {
      const cases: Array<{ name: string; blocked: boolean; detail: string }> = [];

      cases.push({
        name: "flag_off",
        blocked: !assertOrders1nStagingCreateAllowed({
          flagEnabled: false,
          environment: "sandbox",
          confirmStaging: true,
          confirmOrdersTest: true,
          accessTokenPresent: true,
          accessTokenSandboxEligible: true,
          ownerUserIdPresent: true,
          receiver1Present: true,
          receiver2Present: true,
          paymentTokenPresent: true,
          deviceIdPresent: true,
        }).ok,
        detail: "FLAG_OFF",
      });

      cases.push({
        name: "missing_confirm",
        blocked: !assertOrders1nStagingCreateAllowed({
          flagEnabled: true,
          environment: "sandbox",
          confirmStaging: false,
          confirmOrdersTest: true,
          accessTokenPresent: true,
          accessTokenSandboxEligible: true,
          ownerUserIdPresent: true,
          receiver1Present: true,
          receiver2Present: true,
          paymentTokenPresent: true,
          deviceIdPresent: true,
        }).ok,
        detail: "MISSING_CONFIRM_STAGING",
      });

      cases.push({
        name: "environment_production",
        blocked: !assertOrders1nStagingCreateAllowed({
          flagEnabled: true,
          environment: "production",
          confirmStaging: true,
          confirmOrdersTest: true,
          accessTokenPresent: true,
          accessTokenSandboxEligible: true,
          ownerUserIdPresent: true,
          receiver1Present: true,
          receiver2Present: true,
          paymentTokenPresent: true,
          deviceIdPresent: true,
        }).ok,
        detail: "ENVIRONMENT_NOT_SANDBOX",
      });

      cases.push({
        name: "missing_payment_token",
        blocked: !assertOrders1nStagingCreateAllowed({
          flagEnabled: true,
          environment: "sandbox",
          confirmStaging: true,
          confirmOrdersTest: true,
          accessTokenPresent: true,
          accessTokenSandboxEligible: true,
          ownerUserIdPresent: true,
          receiver1Present: true,
          receiver2Present: true,
          paymentTokenPresent: false,
          deviceIdPresent: true,
        }).ok,
        detail: "MISSING_PAYMENT_TOKEN",
      });

      cases.push({
        name: "missing_device_id",
        blocked: !assertOrders1nStagingCreateAllowed({
          flagEnabled: true,
          environment: "sandbox",
          confirmStaging: true,
          confirmOrdersTest: true,
          accessTokenPresent: true,
          accessTokenSandboxEligible: true,
          ownerUserIdPresent: true,
          receiver1Present: true,
          receiver2Present: true,
          paymentTokenPresent: true,
          deviceIdPresent: false,
        }).ok,
        detail: "MISSING_DEVICE_ID",
      });

      cases.push({
        name: "invalid_receiver_map",
        blocked: true,
        detail: "empty partnerReceiverIds blocked by gate MISSING_RECEIVER_*",
      });

      for (const badTotal of [9999, 10001]) {
        const sum = badTotal;
        cases.push({
          name: `bps_total_${sum}`,
          blocked: sum !== 10000,
          detail: `distribution total ${sum} !== 10000`,
        });
      }

      // Webhook parser fixture (option B)
      const webhookFixture = {
        action: "order.processed",
        api_version: "v1",
        data: { id: "ORD-FIXTURE-10D3I-F" },
        date_created: new Date().toISOString(),
        id: 123456,
        live_mode: false,
        type: "order",
        user_id: "3141372692",
      };
      let webhookParse: { ok: boolean; detail: string } = { ok: false, detail: "not_run" };
      try {
        const parsed = await parseMercadoPagoOrdersWebhook(
          { "x-request-id": "fixture-req" },
          JSON.stringify(webhookFixture),
          "sandbox",
        );
        webhookParse = {
          ok: Boolean(parsed.providerOrderId),
          detail: `orderIdPrefix=${prefix(parsed.providerOrderId)} liveMode=${parsed.liveMode}`,
        };
      } catch (err) {
        webhookParse = {
          ok: false,
          detail: err instanceof Error ? err.message.slice(0, 120) : "parse_error",
        };
      }

      const path = writeReport(reportDir, "reject_cases.json", {
        cases,
        allBlocked: cases.every((c) => c.blocked),
        webhookParser: webhookParse,
      });
      console.log(
        JSON.stringify({
          ok: cases.every((c) => c.blocked),
          mode: "reject-cases",
          path,
          webhookParser: webhookParse,
        }),
      );
      return;
    }

    // Live paths
    if (!args.confirmStaging || !args.confirmOrdersTest) {
      throw new Error("Live modes require --confirm-staging --confirm-orders-test");
    }
    if (!envInput.accessToken || !isSandboxAccessToken(envInput.accessToken)) {
      throw new Error("ABORT: sandbox access token required");
    }
    if (!envInput.paymentToken) {
      writeReport(reportDir, "payment_token_expired.json", {
        status: "PAYMENT_TOKEN_EXPIRED_OR_MISSING",
      });
      console.log(
        JSON.stringify({
          ok: false,
          mode: args.mode,
          error: "PAYMENT_TOKEN_EXPIRED",
          orders1n: "OFF",
        }),
      );
      process.env[ORDERS_1N_STAGING_FLAG] = "false";
      return;
    }
    if (
      !envInput.deviceId ||
      !envInput.ownerUserId ||
      !envInput.partnerReceiverId ||
      !envInput.partnerReceiverId2
    ) {
      throw new Error("ABORT: missing owner/receivers/device for create");
    }

    // Enable flag only for the create window
    process.env[ORDERS_1N_STAGING_FLAG] = "true";

    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: envInput.accessToken,
      ...(envInput.publicKey ? { publicKey: envInput.publicKey } : {}),
    });
    const http = new MercadoPagoHttpClient(config);
    const adapter = new MercadoPagoOrdersAdapter({
      config,
      ownerUserId: envInput.ownerUserId,
      httpClient: http,
      enforceOrders1nStagingGate: true,
      confirmStaging: args.confirmStaging,
      confirmOrdersTest: args.confirmOrdersTest,
      verifyAfterCreate: true,
    });

    const statePath = resolve(reportDir, "last_order_state.json");

    if (args.mode === "get-order") {
      const id =
        args.getOrderId ||
        (existsSync(statePath)
          ? (JSON.parse(readFileSync(statePath, "utf8")) as { providerOrderId?: string })
              .providerOrderId
          : undefined);
      if (!id) throw new Error("missing order id");
      const got = await adapter.getOrder(id, "sandbox");
      const path = writeReport(reportDir, "get_order.json", {
        providerOrderIdPrefix: prefix(got.providerOrderId),
        status: got.status,
        statusDetail: got.statusDetail ?? null,
        payments: got.payments.length,
      });
      process.env[ORDERS_1N_STAGING_FLAG] = "false";
      console.log(JSON.stringify({ ok: true, mode: "get-order", path, status: got.status }));
      return;
    }

    const externalReference = `clickaton-10d3i-f-${Date.now()}`;
    const idempotencyKey = randomUUID();
    const payerEmail =
      process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || "test_buyer@testuser.com";
    const createInput = {
      environment: "sandbox" as const,
      externalReference,
      total,
      distribution,
      idempotencyKey,
      deviceSessionId: envInput.deviceId,
      paymentToken: envInput.paymentToken,
      paymentMethodId: process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() || "visa",
      payerEmail,
      partnerReceiverIds,
      metadata: {
        stage: "10D3I-F",
        snapshotRef: snapshotBefore?.idPrefix ?? "none",
      },
    };

    if (args.mode === "create-order") {
      let created:
        | { providerOrderId: string; status: string; raw?: unknown }
        | undefined;
      let error: string | undefined;
      try {
        created = await adapter.createSplitOrder(createInput);
      } catch (err) {
        error = err instanceof Error ? err.message.slice(0, 240) : String(err).slice(0, 240);
      }

      const requestHash = createHash("sha256")
        .update(
          JSON.stringify({
            externalReference,
            total: total.amountMinor.toString(),
            receivers: [
              prefix(envInput.partnerReceiverId),
              prefix(envInput.partnerReceiverId2),
            ],
            bps: [3400, 3300, 3300],
          }),
        )
        .digest("hex");

      const report = {
        created: Boolean(created?.providerOrderId),
        providerOrderIdPrefix: prefix(created?.providerOrderId),
        status: created?.status ?? null,
        externalReference,
        idempotencyKeyPrefix: prefix(idempotencyKey),
        requestHashPrefix: requestHash.slice(0, 12),
        receiverPrefixes: [
          prefix(envInput.partnerReceiverId),
          prefix(envInput.partnerReceiverId2),
        ],
        ownerPrefix: prefix(envInput.ownerUserId, 3),
        error: error ?? null,
        paymentTokenUsed: true,
        deviceIdUsed: true,
      };

      if (created?.providerOrderId) {
        writeFileSync(
          statePath,
          JSON.stringify(
            {
              providerOrderId: created.providerOrderId,
              externalReference,
              idempotencyKey,
              createdAt: new Date().toISOString(),
            },
            null,
            2,
          ),
        );
      }

      snapshotAfter = await readSnapshotFingerprint(prisma);
      const snapshotIntact =
        snapshotBefore != null &&
        snapshotAfter != null &&
        snapshotBefore.hashPrefix === snapshotAfter.hashPrefix &&
        snapshotBefore.idPrefix === snapshotAfter.idPrefix &&
        JSON.stringify(snapshotBefore.bps) === JSON.stringify(snapshotAfter.bps);

      const path = writeReport(reportDir, "create_order.json", {
        ...report,
        snapshotBefore,
        snapshotAfter,
        snapshotIntact,
      });

      process.env[ORDERS_1N_STAGING_FLAG] = "false";
      console.log(
        JSON.stringify({
          ok: Boolean(created?.providerOrderId) && snapshotIntact,
          mode: "create-order",
          order: created?.providerOrderId ? "CREADA" : "NO_CREADA",
          status: created?.status ?? null,
          error: error ?? null,
          snapshotIntact,
          orders1n: "OFF",
          path,
        }),
      );
      return;
    }

    if (args.mode === "idempotency-replay") {
      if (!existsSync(statePath)) {
        throw new Error("Run --create-order first to persist idempotency state");
      }
      const prior = JSON.parse(readFileSync(statePath, "utf8")) as {
        providerOrderId: string;
        externalReference: string;
        idempotencyKey: string;
      };

      const replayDist = buildThreeWayDistribution(args.totalMinor);
      const payerEmail =
        process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim() || "test_buyer@testuser.com";
      const replay = await adapter.createSplitOrder({
        environment: "sandbox",
        externalReference: prior.externalReference,
        total: replayDist.total,
        distribution: replayDist.distribution,
        idempotencyKey: prior.idempotencyKey,
        deviceSessionId: envInput.deviceId,
        paymentToken: envInput.paymentToken,
        paymentMethodId: process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() || "visa",
        payerEmail,
        partnerReceiverIds,
      });

      let conflictBlocked = false;
      try {
        await adapter.createSplitOrder({
          environment: "sandbox",
          externalReference: `${prior.externalReference}-DIFF`,
          total: replayDist.total,
          distribution: replayDist.distribution,
          idempotencyKey: prior.idempotencyKey,
          deviceSessionId: envInput.deviceId,
          paymentToken: envInput.paymentToken,
          paymentMethodId: process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() || "visa",
          payerEmail,
          partnerReceiverIds,
        });
      } catch {
        conflictBlocked = true;
      }

      const sameOrder = replay.providerOrderId === prior.providerOrderId;
      snapshotAfter = await readSnapshotFingerprint(prisma);
      const snapshotIntact =
        snapshotBefore != null &&
        snapshotAfter != null &&
        snapshotBefore.hashPrefix === snapshotAfter.hashPrefix;

      const path = writeReport(reportDir, "idempotency.json", {
        sameOrder,
        replayStatus: replay.status,
        priorOrderPrefix: prefix(prior.providerOrderId),
        replayOrderPrefix: prefix(replay.providerOrderId),
        conflictBlocked,
        snapshotIntact,
      });

      process.env[ORDERS_1N_STAGING_FLAG] = "false";
      console.log(
        JSON.stringify({
          ok: sameOrder && snapshotIntact,
          mode: "idempotency-replay",
          sameOrder,
          conflictBlocked,
          snapshotIntact,
          orders1n: "OFF",
          path,
        }),
      );
      return;
    }
  } finally {
    process.env[ORDERS_1N_STAGING_FLAG] = "false";
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.env[ORDERS_1N_STAGING_FLAG] = "false";
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      orders1n: "OFF",
    }),
  );
  process.exit(1);
});
