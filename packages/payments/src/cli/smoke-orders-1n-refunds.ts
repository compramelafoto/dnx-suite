/**
 * SANDBOX REAL smoke for Orders 1:N refunds (Imp 04).
 *
 * Does NOT run automatically without confirms + sandbox token.
 * Distinguishes MOCK/UNIT from SANDBOX REAL.
 *
 * Usage:
 *   DNX_CONFIRM_STAGING=true DNX_CONFIRM_ORDERS_TEST=true \
 *   DNX_CONFIRM_REFUND_SMOKE=true \
 *   pnpm --filter @repo/payments smoke:orders-1n-refunds
 *
 * Flow (when enabled):
 * 1) Preflight credentials (no secrets printed)
 * 2) Requires existing PROCESSED order id + payment transaction id in env
 * 3) Partial refund → GET order → remaining refund → GET order
 *
 * Env:
 *   MERCADOPAGO_TEST_ACCESS_TOKEN
 *   MERCADOPAGO_SMOKE_ORDER_ID
 *   MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID
 *   MERCADOPAGO_SMOKE_PARTIAL_AMOUNT_MINOR (optional, default 100)
 */

function present(name: string): "SET" | "MISSING" {
  const v = process.env[name];
  return v && v.trim().length > 0 ? "SET" : "MISSING";
}

function flagTrue(name: string): boolean {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

async function main() {
  console.log("ORDERS_1N_REFUND_SMOKE — presence only (no secrets)");
  const rows: Array<[string, string]> = [
    ["MERCADOPAGO_TEST_ACCESS_TOKEN", present("MERCADOPAGO_TEST_ACCESS_TOKEN")],
    ["MERCADOPAGO_SMOKE_ORDER_ID", present("MERCADOPAGO_SMOKE_ORDER_ID")],
    [
      "MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID",
      present("MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID"),
    ],
    ["DNX_CONFIRM_STAGING", present("DNX_CONFIRM_STAGING")],
    ["DNX_CONFIRM_ORDERS_TEST", present("DNX_CONFIRM_ORDERS_TEST")],
    ["DNX_CONFIRM_REFUND_SMOKE", present("DNX_CONFIRM_REFUND_SMOKE")],
  ];
  for (const [k, v] of rows) console.log(`  ${k}=${v}`);

  const confirms =
    flagTrue("DNX_CONFIRM_STAGING") &&
    flagTrue("DNX_CONFIRM_ORDERS_TEST") &&
    flagTrue("DNX_CONFIRM_REFUND_SMOKE");

  if (!confirms) {
    console.log("");
    console.log("KIND: SANDBOX_REAL_PENDING_CONFIRMS");
    console.log(
      "Set DNX_CONFIRM_STAGING=true DNX_CONFIRM_ORDERS_TEST=true DNX_CONFIRM_REFUND_SMOKE=true",
    );
    console.log("plus smoke order/transaction ids to execute HTTP refunds.");
    console.log("See docs/payments/mp-split-1n-refunds.md");
    return;
  }

  if (
    present("MERCADOPAGO_TEST_ACCESS_TOKEN") === "MISSING" ||
    present("MERCADOPAGO_SMOKE_ORDER_ID") === "MISSING" ||
    present("MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID") === "MISSING"
  ) {
    console.error("REFUND_SMOKE_BLOCKED: missing required env");
    process.exitCode = 2;
    return;
  }

  const { createMercadoPagoProviderConfig } = await import(
    "../providers/mercado-pago/client/mercado-pago-environment.js"
  );
  const { MercadoPagoHttpClient } = await import(
    "../providers/mercado-pago/client/mercado-pago-http-client.js"
  );
  const { MercadoPagoOrdersAdapter } = await import(
    "../providers/mercado-pago/orders/adapter.js"
  );
  const { money } = await import("../money/index.js");
  const { randomUUID } = await import("node:crypto");

  const token = process.env.MERCADOPAGO_TEST_ACCESS_TOKEN!.trim();
  const orderId = process.env.MERCADOPAGO_SMOKE_ORDER_ID!.trim();
  const txId = process.env.MERCADOPAGO_SMOKE_PAYMENT_TRANSACTION_ID!.trim();
  const partialMinor = BigInt(
    process.env.MERCADOPAGO_SMOKE_PARTIAL_AMOUNT_MINOR?.trim() || "100",
  );
  const ownerUserId =
    process.env.MERCADOPAGO_TEST_OWNER_USER_ID?.trim() || "sandbox-owner";

  const config = createMercadoPagoProviderConfig({
    accessToken: token,
    environment: "sandbox",
  });
  const http = new MercadoPagoHttpClient(config);
  const adapter = new MercadoPagoOrdersAdapter({
    config,
    ownerUserId,
    httpClient: http,
    allowTestFixtures: true,
    enforceOrders1nStagingGate: false,
  });

  console.log("STEP1 GET order");
  const before = await adapter.getOrder(orderId, "sandbox");
  console.log(
    JSON.stringify({
      status: before.status,
      statusDetail: before.statusDetail ?? null,
      paymentCount: before.payments.length,
    }),
  );

  console.log("STEP2 partial refund");
  const partial = await adapter.refund({
    providerOrderId: orderId,
    amount: money("ARS", partialMinor),
    providerTransactionId: txId,
    idempotencyKey: `smoke-partial-${randomUUID()}`.slice(0, 64),
  });
  console.log(
    JSON.stringify({
      providerRefundIdPrefix: partial.providerRefundId.slice(0, 10) + "…",
      orderStatus: partial.orderStatus ?? null,
    }),
  );

  console.log("STEP3 GET order after partial");
  const mid = await adapter.getOrder(orderId, "sandbox");
  console.log(
    JSON.stringify({
      status: mid.status,
      statusDetail: mid.statusDetail ?? null,
    }),
  );

  console.log("STEP4 remaining total refund");
  const rest = await adapter.refund({
    providerOrderId: orderId,
    idempotencyKey: `smoke-rest-${randomUUID()}`.slice(0, 64),
  });
  console.log(
    JSON.stringify({
      providerRefundIdPrefix: rest.providerRefundId.slice(0, 10) + "…",
      orderStatus: rest.orderStatus ?? null,
    }),
  );

  console.log("STEP5 GET order final");
  const after = await adapter.getOrder(orderId, "sandbox");
  console.log(
    JSON.stringify({
      status: after.status,
      statusDetail: after.statusDetail ?? null,
    }),
  );
  console.log("KIND: SANDBOX_REAL_EXECUTED");
}

main().catch((err) => {
  console.error(
    "REFUND_SMOKE_FAILED",
    err instanceof Error ? err.message.slice(0, 200) : "unknown",
  );
  process.exitCode = 1;
});
