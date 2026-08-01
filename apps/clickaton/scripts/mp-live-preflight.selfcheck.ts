/**
 * Offline selfcheck: LIVE payments resolve + preflight (no MP HTTP).
 */
import assert from "node:assert/strict";
import {
  preflightClickatonLivePayments,
  resolveClickatonPaymentsProviderMode,
} from "@repo/payments/next";

function main() {
  assert.throws(
    () =>
      resolveClickatonPaymentsProviderMode("mercado_pago_production", {
        env: { VERCEL_ENV: "preview", DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "true" },
      }),
    /mercado_pago_production_forbidden/,
  );

  assert.throws(
    () =>
      resolveClickatonPaymentsProviderMode("mercado_pago_production", {
        env: {
          VERCEL_ENV: "production",
          DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "false",
        },
      }),
    /LIVE_PAYMENTS_DISABLED/,
  );

  const mode = resolveClickatonPaymentsProviderMode("mercado_pago_production", {
    env: {
      VERCEL_ENV: "production",
      DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "true",
    },
  });
  assert.equal(mode, "mercado_pago_production");

  const preflight = preflightClickatonLivePayments({
    env: {
      VERCEL_ENV: "production",
      CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_production",
      DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "false",
      CLICKATON_PUBLIC_URL: "https://maratonfotografica.com",
      DNX_PAYMENTS_WEBHOOK_PUBLIC_URL:
        "https://maratonfotografica.com/api/webhooks/dnx-payments",
    },
    expectedAmountArs: 25000,
    recipientEmail: "dnxfotografia@gmail.com",
    recipientPaymentAccountId: "pa_ba733fa7a35f4326",
    recipientAccountStatus: "ACTIVE",
    recipientAccountEnvironment: "PROD",
    allocationSumPercent: 100,
    registrationEnabled: false,
    collectorTokenPresent: true,
    ownerPaymentAccountIdExpected: "pa_ba733fa7a35f4326",
    ownerPaymentAccountIdActual: "pa_ba733fa7a35f4326",
  });

  assert.equal(preflight.configuration, "READY_CONFIGURATION");
  assert.equal(preflight.liveExecution, "OFF");
  assert.equal(preflight.providerResolveError, "LIVE_PAYMENTS_DISABLED");
  assert.equal(preflight.projected.charge, "NONE_PREFLIGHT");

  console.log(
    JSON.stringify({
      ok: true,
      configuration: preflight.configuration,
      liveExecution: preflight.liveExecution,
      checks: 4,
    }),
  );
}

main();
