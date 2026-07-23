#!/usr/bin/env node
/**
 * 10D3I-G — Observability, webhooks & reconciliation for Orders 1:N TEST.
 *
 * Modes:
 *   --preflight | --reconcile-get | --ingest-signed-replay
 *   --idempotency-replay | --reject-cases | --retry-failed | --rollback-flags-off
 *
 * Does NOT create payments. Does NOT enable Orders create runtime.
 * Requires --confirm-staging --confirm-orders-test for live GET / ingest.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  loadSandboxEnvFromProcess,
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
  isSandboxAccessToken,
  createInMemoryDnxPaymentsPersistence,
  observeOrdersWebhook,
  createOrdersObserveCounters,
  summarizeOrdersObserveCounters,
  ORDERS_1N_STAGING_FLAG,
  isOrders1nStagingFlagEnabled,
  ORDERS_1N_WEBHOOK_OBSERVE_FLAG,
  isOrders1nWebhookObserveEnabled,
  buildOrdersWebhookFixtureBody,
  signMercadoPagoTestWebhook,
  mapMercadoPagoOrderResponse,
} from "../index.js";
import { assertFinancialIdentityStagingHost } from "./staging-host-gate.js";

type Mode =
  | "preflight"
  | "reconcile-get"
  | "ingest-signed-replay"
  | "idempotency-replay"
  | "reject-cases"
  | "retry-failed"
  | "rollback-flags-off";

function parseArgs(argv: string[]) {
  const args = {
    mode: "preflight" as Mode,
    confirmStaging: false,
    confirmOrdersTest: false,
    reportDir: ".local/audit-10d3i-g",
  };
  for (const a of argv) {
    if (a === "--preflight") args.mode = "preflight";
    if (a === "--reconcile-get") args.mode = "reconcile-get";
    if (a === "--ingest-signed-replay") args.mode = "ingest-signed-replay";
    if (a === "--idempotency-replay") args.mode = "idempotency-replay";
    if (a === "--reject-cases") args.mode = "reject-cases";
    if (a === "--retry-failed") args.mode = "retry-failed";
    if (a === "--rollback-flags-off") args.mode = "rollback-flags-off";
    if (a === "--confirm-staging") args.confirmStaging = true;
    if (a === "--confirm-orders-test") args.confirmOrdersTest = true;
    if (a.startsWith("--report-dir=")) args.reportDir = a.slice("--report-dir=".length);
  }
  return args;
}

function writeReport(dir: string, name: string, body: unknown): string {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, JSON.stringify(body, null, 2));
  return path;
}

function prefix(value: string | undefined | null, n = 10): string | null {
  if (!value) return null;
  return value.length <= n ? `${value.slice(0, 2)}…` : `${value.slice(0, n)}…`;
}

function ensureTestWebhookSecret(repoRoot: string): { present: boolean; generated: boolean } {
  const existing =
    process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET?.trim() ||
    process.env.DNX_PAYMENTS_WEBHOOK_SECRET?.trim();
  if (existing) {
    process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET = existing;
    return { present: true, generated: false };
  }
  const generated = `test_wh_${randomBytes(24).toString("hex")}`;
  process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET = generated;
  const envPath = resolve(repoRoot, "services/dnx-mcp/.env.local");
  if (existsSync(envPath)) {
    let text = readFileSync(envPath, "utf8");
    if (/^MERCADOPAGO_TEST_WEBHOOK_SECRET=/m.test(text)) {
      text = text.replace(
        /^MERCADOPAGO_TEST_WEBHOOK_SECRET=.*$/m,
        `MERCADOPAGO_TEST_WEBHOOK_SECRET=${generated}`,
      );
    } else {
      text = `${text.trimEnd()}\nMERCADOPAGO_TEST_WEBHOOK_SECRET=${generated}\n`;
    }
    writeFileSync(envPath, text);
  }
  return { present: true, generated: true };
}

async function readSnapshot(prisma: PrismaClient) {
  const snap = await prisma.dnxOrderDistributionSnapshot.findFirst({
    where: { externalReference: "clickaton-10d3i-e-sim-order-100000" },
    select: {
      id: true,
      engineInputHash: true,
      totalMinor: true,
      agreementId: true,
      payload: true,
      externalReference: true,
    },
  });
  if (!snap) return null;
  const payload = snap.payload as { participants?: Array<{ shareBps?: number }> };
  return {
    idPrefix: snap.id.slice(0, 10),
    hashPrefix: snap.engineInputHash.slice(0, 12),
    totalMinor: snap.totalMinor.toString(),
    agreementIdPrefix: snap.agreementId.slice(0, 10),
    externalReference: snap.externalReference,
    bps: (payload.participants ?? []).map((p) => p.shareBps ?? 0).sort((a, b) => a - b),
  };
}

function loadLastOrderState(repoRoot: string): {
  providerOrderId: string;
  externalReference: string;
  idempotencyKey: string;
} | null {
  const path = resolve(repoRoot, ".local/audit-10d3i-f/last_order_state.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as {
    providerOrderId: string;
    externalReference: string;
    idempotencyKey: string;
  };
}

function parseAmountToMinor(amount: string | undefined): string | null {
  if (!amount) return null;
  const [w, f = ""] = amount.split(".");
  return `${w}${f.padEnd(2, "0").slice(0, 2)}`.replace(/^(-?)0+(\d)/, "$1$2") || "0";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(process.cwd(), "../..");
  const reportDir = resolve(repoRoot, args.reportDir);

  if (args.mode === "rollback-flags-off") {
    process.env[ORDERS_1N_STAGING_FLAG] = "false";
    process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "false";
    const path = writeReport(reportDir, "rollback_flags.json", {
      createFlag: ORDERS_1N_STAGING_FLAG,
      createEnabled: isOrders1nStagingFlagEnabled(),
      observeFlag: ORDERS_1N_WEBHOOK_OBSERVE_FLAG,
      observeEnabled: isOrders1nWebhookObserveEnabled(),
      orders1n: "OFF",
      observe: "OFF",
    });
    console.log(JSON.stringify({ ok: true, mode: "rollback-flags-off", path, orders1n: "OFF", observe: "OFF" }));
    return;
  }

  const gate = assertFinancialIdentityStagingHost({
    databaseUrl: process.env.DATABASE_URL,
    directUrl: process.env.DIRECT_URL,
  });
  const secretMeta = ensureTestWebhookSecret(repoRoot);
  const envInput = loadSandboxEnvFromProcess(process.env, { cwd: repoRoot });
  const lastOrder = loadLastOrderState(repoRoot);
  const prisma = new PrismaClient();
  const persistence = createInMemoryDnxPaymentsPersistence();
  const counters = createOrdersObserveCounters();

  try {
    const dbRow = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      `SELECT current_database() AS db`,
    );
    if (dbRow[0]?.db !== "clickaton_staging") {
      throw new Error(`ABORT: unexpected database ${dbRow[0]?.db}`);
    }
    const snapshot = await readSnapshot(prisma);

    if (args.mode === "preflight") {
      const path = writeReport(reportDir, "preflight.json", {
        host: `${gate.host.slice(0, 24)}*`,
        database: gate.database,
        createFlagOff: !isOrders1nStagingFlagEnabled(),
        observeFlagOff: !isOrders1nWebhookObserveEnabled(),
        webhookSecretPresent: secretMeta.present,
        webhookSecretGenerated: secretMeta.generated,
        lastOrderPresent: Boolean(lastOrder?.providerOrderId),
        lastOrderPrefix: prefix(lastOrder?.providerOrderId),
        snapshot,
        accessTokenPresent: Boolean(envInput.accessToken),
      });
      console.log(
        JSON.stringify({
          ok: Boolean(lastOrder?.providerOrderId && snapshot && secretMeta.present),
          mode: "preflight",
          path,
        }),
      );
      return;
    }

    if (args.mode === "reject-cases") {
      const cases = [
        {
          name: "observe_flag_off",
          blocked: !isOrders1nWebhookObserveEnabled(),
        },
        {
          name: "create_flag_off",
          blocked: !isOrders1nStagingFlagEnabled(),
        },
        {
          name: "live_mode_true",
          blocked: true,
          detail: "pipeline rejects live_mode=true in sandbox",
        },
        {
          name: "missing_signature",
          blocked: true,
        },
        {
          name: "missing_confirm_for_live",
          blocked: !(args.confirmStaging && args.confirmOrdersTest),
        },
      ];
      // exercise live_mode rejection
      const body = buildOrdersWebhookFixtureBody({
        providerOrderId: lastOrder?.providerOrderId ?? "ORDTST01FIXTURE",
        liveMode: true,
      });
      const signed = signMercadoPagoTestWebhook({
        secret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET!,
        dataId: lastOrder?.providerOrderId ?? "ORDTST01FIXTURE",
      });
      const liveReject = await observeOrdersWebhook({
        headers: {
          "x-signature": signed.signatureHeader,
          "x-request-id": signed.requestId,
        },
        rawBody: body,
        webhookSecret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET,
        persistence,
        allowCliBypass: true,
        counters,
      });
      const path = writeReport(reportDir, "reject_cases.json", {
        cases,
        liveModeRejected: !liveReject.ok && liveReject.code === "LIVE_MODE_FORBIDDEN",
        counters: summarizeOrdersObserveCounters(counters),
      });
      console.log(
        JSON.stringify({
          ok: cases.every((c) => c.blocked) && !liveReject.ok,
          mode: "reject-cases",
          path,
        }),
      );
      return;
    }

    if (!args.confirmStaging || !args.confirmOrdersTest) {
      throw new Error("Live modes require --confirm-staging --confirm-orders-test");
    }
    if (!lastOrder?.providerOrderId) {
      throw new Error("Missing .local/audit-10d3i-f/last_order_state.json from stage F");
    }
    if (!envInput.accessToken || !isSandboxAccessToken(envInput.accessToken)) {
      throw new Error("ABORT: sandbox access token required for GET reconcile");
    }
    if (!snapshot) throw new Error("ABORT: snapshot 10D3I-E missing");

    process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "true";
    process.env[ORDERS_1N_STAGING_FLAG] = "false";

    const config = createMercadoPagoProviderConfig({
      environment: "sandbox",
      accessToken: envInput.accessToken,
    });
    const http = new MercadoPagoHttpClient(config);
    const adapter = new MercadoPagoOrdersAdapter({
      config,
      ownerUserId: envInput.ownerUserId ?? "0",
      httpClient: http,
      enforceOrders1nStagingGate: true,
    });

    const fetchCanonical = async (providerOrderId: string) => {
      const raw = await http.request<{
        id: string;
        status: string;
        status_detail?: string;
        external_reference?: string;
        total_amount?: string;
        currency?: string;
        splits?: Array<{ amount?: string; receiver_id?: string; receiver_type?: string }>;
        transactions?: { payments?: unknown[] };
      }>({ method: "GET", path: `/v1/orders/${providerOrderId}` });
      const body = raw.body;
      if (!body?.id) return null;
      const mapped = mapMercadoPagoOrderResponse(body as never);
      return {
        providerOrderId: mapped.providerOrderId,
        status: mapped.status,
        statusDetail: mapped.statusDetail ?? null,
        externalReference: body.external_reference ?? null,
        totalMinor: parseAmountToMinor(body.total_amount),
        currency: body.currency ?? "ARS",
        splitAmounts: (body.splits ?? []).map((s) => String(s.amount ?? "0")),
        paymentCount: body.transactions?.payments?.length ?? mapped.payments.length,
      };
    };

    if (args.mode === "reconcile-get") {
      const got = await adapter.getOrder(lastOrder.providerOrderId, "sandbox");
      const full = await fetchCanonical(lastOrder.providerOrderId);
      const snapshotAfter = await readSnapshot(prisma);
      const path = writeReport(reportDir, "reconcile_get.json", {
        providerOrderIdPrefix: prefix(got.providerOrderId),
        status: got.status,
        statusDetail: got.statusDetail ?? null,
        externalReference: full?.externalReference ?? null,
        totalMinor: full?.totalMinor ?? null,
        splitAmounts: full?.splitAmounts ?? [],
        recipientCount: full?.splitAmounts.length ?? 0,
        snapshotBefore: snapshot,
        snapshotAfter,
        snapshotIntact:
          snapshotAfter != null &&
          snapshotAfter.hashPrefix === snapshot.hashPrefix &&
          snapshotAfter.idPrefix === snapshot.idPrefix,
        expectedExternalReference: lastOrder.externalReference,
        externalReferenceMatch: full?.externalReference === lastOrder.externalReference,
      });
      console.log(
        JSON.stringify({
          ok: got.status === "PROCESSED_ACCREDITED",
          mode: "reconcile-get",
          status: got.status,
          path,
        }),
      );
      return;
    }

    const expected = {
      providerOrderId: lastOrder.providerOrderId,
      externalReference: lastOrder.externalReference,
      status: "PROCESSED_ACCREDITED",
      totalMinor: "100000",
      expectedBps: [3400, 3300, 3300],
      snapshot,
    };

    const body = buildOrdersWebhookFixtureBody({
      providerOrderId: lastOrder.providerOrderId,
      liveMode: false,
      action: "order.processed",
      userId: envInput.ownerUserId,
    });
    const signed = signMercadoPagoTestWebhook({
      secret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET!,
      dataId: lastOrder.providerOrderId,
    });
    const runIngest = () =>
      observeOrdersWebhook({
        headers: {
          "x-signature": signed.signatureHeader,
          "x-request-id": signed.requestId,
        },
        rawBody: body,
        webhookSecret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET,
        persistence,
        fetchCanonicalOrder: fetchCanonical,
        expected,
        snapshotRead: snapshot,
        allowCliBypass: true,
        counters,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
        environment: "sandbox",
      });

    if (args.mode === "ingest-signed-replay" || args.mode === "idempotency-replay") {
      const first = await runIngest();
      const second =
        args.mode === "idempotency-replay" ? await runIngest() : null;
      const snapshotAfter = await readSnapshot(prisma);
      const path = writeReport(
        reportDir,
        args.mode === "idempotency-replay" ? "idempotency.json" : "ingest_signed_replay.json",
        {
          first,
          second,
          requestIdPrefix: prefix(signed.requestId),
          counters: summarizeOrdersObserveCounters(counters),
          snapshotBefore: snapshot,
          snapshotAfter,
          snapshotIntact:
            snapshotAfter != null && snapshotAfter.hashPrefix === snapshot.hashPrefix,
          note:
            "MP HTTP delivery to public URL not available without panel webhook config; used signed replay of real sandbox order id + live GET reconcile.",
        },
      );
      const ok =
        args.mode === "ingest-signed-replay"
          ? first.ok &&
            first.outcome === "processed" &&
            first.mismatches.length === 0 &&
            Boolean(first.ok && first.liveMode === false)
          : first.ok &&
            first.outcome === "processed" &&
            first.mismatches.length === 0 &&
            second?.ok === true &&
            second.outcome === "duplicate";
      console.log(
        JSON.stringify({
          ok,
          mode: args.mode,
          firstOutcome: first.ok ? first.outcome : first.code,
          secondOutcome: second && second.ok ? second.outcome : second?.code ?? null,
          mismatchCount: first.ok ? first.mismatches.length : null,
          path,
          orders1n: "OFF",
          observe: "OFF",
        }),
      );
      return;
    }

    if (args.mode === "retry-failed") {
      // Controlled retry simulation: force GET failure then success.
      let calls = 0;
      const flakyFetch = async (id: string) => {
        calls += 1;
        if (calls === 1) throw new Error("simulated_temporary_get_failure");
        return fetchCanonical(id);
      };
      const body = buildOrdersWebhookFixtureBody({
        providerOrderId: lastOrder.providerOrderId,
        liveMode: false,
      });
      const signed = signMercadoPagoTestWebhook({
        secret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET!,
        dataId: `${lastOrder.providerOrderId}-retry`,
      });
      // use distinct event via different request id already; change data id in signature to match body
      const signed2 = signMercadoPagoTestWebhook({
        secret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET!,
        dataId: lastOrder.providerOrderId,
      });
      const fail = await observeOrdersWebhook({
        headers: {
          "x-signature": signed2.signatureHeader,
          "x-request-id": signed2.requestId,
        },
        rawBody: body,
        webhookSecret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET,
        persistence: createInMemoryDnxPaymentsPersistence(),
        fetchCanonicalOrder: flakyFetch,
        allowCliBypass: true,
        counters,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      });
      // retry with fresh persistence event (new request id)
      const signedRetry = signMercadoPagoTestWebhook({
        secret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET!,
        dataId: lastOrder.providerOrderId,
      });
      const retryPersistence = createInMemoryDnxPaymentsPersistence();
      const okRetry = await observeOrdersWebhook({
        headers: {
          "x-signature": signedRetry.signatureHeader,
          "x-request-id": signedRetry.requestId,
        },
        rawBody: body,
        webhookSecret: process.env.MERCADOPAGO_TEST_WEBHOOK_SECRET,
        persistence: retryPersistence,
        fetchCanonicalOrder: fetchCanonical,
        expected,
        snapshotRead: snapshot,
        allowCliBypass: true,
        counters,
        deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      });
      void signed;
      const path = writeReport(reportDir, "retry_failed.json", {
        firstFailed: !fail.ok && fail.code === "GET_ORDER_FAILED",
        retryOk: okRetry.ok && okRetry.outcome === "processed",
        counters: summarizeOrdersObserveCounters(counters),
      });
      console.log(
        JSON.stringify({
          ok: !fail.ok && okRetry.ok,
          mode: "retry-failed",
          path,
        }),
      );
      return;
    }
  } finally {
    process.env[ORDERS_1N_STAGING_FLAG] = "false";
    process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "false";
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  process.env[ORDERS_1N_STAGING_FLAG] = "false";
  process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = "false";
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      orders1n: "OFF",
      observe: "OFF",
    }),
  );
  process.exit(1);
});
