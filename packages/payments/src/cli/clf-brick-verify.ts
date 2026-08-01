#!/usr/bin/env node
/**
 * Verify last CLF Card Brick homologation smoke evidence + GET Order.
 *
 *   pnpm --filter @repo/payments smoke:clf-brick-verify
 *
 * Optional override:
 *   MERCADOPAGO_SMOKE_ORDER_ID=ORD…
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
} from "../providers/mercado-pago/index.js";

type Evidence = {
  source: string;
  scenarioId: string;
  partnerCount: number;
  providerOrderId: string;
  providerOrderIdPrefix: string;
  status: string;
  statusDetail: string | null;
  DEVICE_SESSION_PRESENT: boolean;
  deviceSessionIdLength: number;
  amountType: string;
  splitSumValid: boolean;
  productionWrites: string;
};

function prefix(v: string | null | undefined, n = 12): string | null {
  if (!v) return null;
  return v.length <= n ? `${v.slice(0, 2)}…` : `${v.slice(0, n)}…`;
}

function loadEvidence(): Evidence | null {
  const path = resolve(process.cwd(), "../../.local/audit-clf-brick/last.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Evidence;
  } catch {
    return null;
  }
}

async function main() {
  const prod = (process.env.DNX_MP_ORDERS_1N_PRODUCTION_ENABLED ?? "")
    .trim()
    .toLowerCase();
  if (prod === "true" || prod === "1" || prod === "yes") {
    console.log(JSON.stringify({ ok: false, abort: "PRODUCTION SAFETY BLOCKER" }));
    process.exitCode = 99;
    return;
  }

  const evidence = loadEvidence();
  const orderId =
    process.env.MERCADOPAGO_SMOKE_ORDER_ID?.trim() ||
    evidence?.providerOrderId;

  if (!orderId) {
    console.log(
      JSON.stringify({
        ok: false,
        abort: "NO_EVIDENCE",
        hint: "Run CLF Brick homologation first, or set MERCADOPAGO_SMOKE_ORDER_ID",
      }),
    );
    process.exitCode = 2;
    return;
  }

  if (evidence && evidence.source !== "CLF_CARD_BRICK_HOMOLOGATION") {
    console.log(
      JSON.stringify({
        ok: false,
        abort: "WRONG_SOURCE",
        source: evidence.source,
      }),
    );
    process.exitCode = 3;
    return;
  }

  const env = loadSandboxEnvFromProcess();
  if (!env.accessToken || !env.ownerUserId) {
    console.log(JSON.stringify({ ok: false, abort: "SANDBOX_ENV_INCOMPLETE" }));
    process.exitCode = 4;
    return;
  }

  const config = createMercadoPagoProviderConfig({
    accessToken: env.accessToken,
    environment: "sandbox",
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId: env.ownerUserId,
    httpClient: http,
    allowTestFixtures: false,
    enforceOrders1nStagingGate: false,
  });

  const got = await adapter.getOrder(orderId, "sandbox");
  const accredited =
    got.status === "PROCESSED_ACCREDITED" || got.status === "PROCESSED";

  const report = {
    ok: accredited && (evidence?.DEVICE_SESSION_PRESENT ?? true),
    source: evidence?.source ?? "OVERRIDE_ORDER_ID",
    scenarioId: evidence?.scenarioId ?? null,
    partnerCount: evidence?.partnerCount ?? null,
    DEVICE_SESSION_PRESENT: evidence?.DEVICE_SESSION_PRESENT ?? null,
    deviceSessionIdLength: evidence?.deviceSessionIdLength ?? null,
    amountType: evidence?.amountType ?? null,
    splitSumValid: evidence?.splitSumValid ?? null,
    productionWrites: "BLOCKED",
    orderIdPrefix: prefix(orderId),
    getStatus: got.status,
    getStatusDetail: got.statusDetail ?? null,
    transactionPresent: got.payments.length > 0,
    paymentCount: got.payments.length,
    primaryPaymentIdPrefix: prefix(got.payments[0]?.providerPaymentId),
    accredited,
    brickTokenization: "EXPECTED_VIA_BROWSER_BRICK",
    ledgerNote: "Homologation smoke does not write CLF commercial ledger",
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 5;
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      ok: false,
      fatal: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }),
  );
  process.exitCode = 1;
});
