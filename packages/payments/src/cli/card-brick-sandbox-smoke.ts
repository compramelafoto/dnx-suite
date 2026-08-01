/**
 * SANDBOX REAL preflight for Card Payment Brick path (Imp 03).
 *
 * Does NOT drive the Brick (requires human card input in browser).
 * Prints readiness checklist without secrets.
 *
 * Usage:
 *   pnpm --filter @repo/payments exec tsx src/cli/card-brick-sandbox-smoke.ts
 */

function present(name: string): "SET" | "MISSING" {
  const v = process.env[name];
  return v && v.trim().length > 0 ? "SET" : "MISSING";
}

function main() {
  const rows: Array<[string, string]> = [
    ["NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", present("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY")],
    ["MERCADOPAGO_TEST_PUBLIC_KEY", present("MERCADOPAGO_TEST_PUBLIC_KEY")],
    ["MERCADOPAGO_TEST_ACCESS_TOKEN", present("MERCADOPAGO_TEST_ACCESS_TOKEN")],
    ["CLICKATON_DNX_PAYMENTS_PROVIDER", process.env.CLICKATON_DNX_PAYMENTS_PROVIDER?.trim() || "MISSING"],
    ["DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED", present("DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED")],
    ["DNX_MP_ORDERS_1N_STAGING_ENABLED", present("DNX_MP_ORDERS_1N_STAGING_ENABLED")],
    ["DNX_CONFIRM_STAGING", present("DNX_CONFIRM_STAGING")],
    ["DNX_CONFIRM_ORDERS_TEST", present("DNX_CONFIRM_ORDERS_TEST")],
    ["MERCADOPAGO_TEST_PARTNER_RECEIVER_ID", present("MERCADOPAGO_TEST_PARTNER_RECEIVER_ID")],
    ["MERCADOPAGO_TEST_PARTNER_RECEIVER_ID_2", present("MERCADOPAGO_TEST_PARTNER_RECEIVER_ID_2")],
    ["MERCADOPAGO_TEST_OWNER_USER_ID", present("MERCADOPAGO_TEST_OWNER_USER_ID")],
  ];

  console.log("CARD_BRICK_SANDBOX_SMOKE_PREFLIGHT (no secrets printed)");
  for (const [k, v] of rows) {
    console.log(`  ${k}=${v}`);
  }
  console.log("");
  console.log("NEXT_STEP: follow apps/clickaton/scripts/card-brick-sandbox-smoke.md");
  console.log("KIND: SANDBOX_REAL_BROWSER_REQUIRED");
  console.log("This CLI is NOT a substitute for Brick + card input.");
}

main();
