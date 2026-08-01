#!/usr/bin/env node
/**
 * IMPLEMENTACIÓN 06 — Verify Order created via Card Payment Brick (browser).
 *
 * After Dani completes the human Brick steps, run:
 *
 *   MERCADOPAGO_SMOKE_ORDER_ID=ORD… \
 *   pnpm --filter @repo/payments exec tsx src/cli/imp06-brick-verify.ts
 *
 * Optional:
 *   MERCADOPAGO_SMOKE_REGISTRATION_ID=…
 *
 * Never prints tokens / PAN / full device ids.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import {
  createMercadoPagoProviderConfig,
  MercadoPagoHttpClient,
  MercadoPagoOrdersAdapter,
} from "../providers/mercado-pago/index.js";

function prefix(v: string | null | undefined, n = 12): string | null {
  if (!v) return null;
  return v.length <= n ? `${v.slice(0, 2)}…` : `${v.slice(0, n)}…`;
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

  const orderId = process.env.MERCADOPAGO_SMOKE_ORDER_ID?.trim();
  if (!orderId) {
    console.log(
      JSON.stringify({
        ok: false,
        abort: "MISSING_ORDER_ID",
        hint: "Set MERCADOPAGO_SMOKE_ORDER_ID from Brick success (never card data)",
        humanSteps: "apps/clickaton/scripts/card-brick-sandbox-smoke.md",
      }),
    );
    process.exitCode = 2;
    return;
  }

  const env = loadSandboxEnvFromProcess();
  if (!env.accessToken || !env.ownerUserId) {
    console.log(JSON.stringify({ ok: false, abort: "SANDBOX_ENV_INCOMPLETE" }));
    process.exitCode = 3;
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
    source: "CARD_BRICK_BROWSER",
    productionWrites: "BLOCKED",
    orderIdPrefix: prefix(orderId),
    registrationIdPresent: Boolean(
      process.env.MERCADOPAGO_SMOKE_REGISTRATION_ID?.trim(),
    ),
    receiversNote:
      "Split receivers confirmed at create time; GET may omit full split dump",
    amountType: "fixed_preferred_at_create",
    status: got.status,
    statusDetail: got.statusDetail ?? null,
    payerPresent: true, // required at create; not re-logged here
    transactionPresent: got.payments.length > 0,
    paymentCount: got.payments.length,
    primaryPaymentIdPrefix: prefix(got.payments[0]?.providerPaymentId),
    deviceHeaderPresent:
      "EXPECTED_AT_CREATE — confirm server log DEVICE_SESSION_PRESENT=true",
    idempotencyPresent: "EXPECTED_AT_CREATE",
    accredited,
    verdict: accredited ? "PASS" : "FAIL_OR_PENDING",
  };

  const dir = resolve(process.cwd(), "../../.local/audit-imp06");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, "brick-order-verify.json");
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: accredited, ...report, wrote: path }, null, 2));
  if (!accredited) process.exitCode = 4;
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
