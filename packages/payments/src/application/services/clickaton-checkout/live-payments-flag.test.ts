import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertLivePaymentsExecutionAllowed,
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
  resolveClickatonPaymentsProviderModeControlled,
} from "./live-payments-flag";
import { preflightClickatonLivePayments } from "./live-payments-preflight";

describe("Clickatón LIVE payments flag (10E.4)", () => {
  it("PROD + LIVE flag OFF → LIVE_PAYMENTS_DISABLED", () => {
    assert.throws(
      () =>
        resolveClickatonPaymentsProviderModeControlled("mercado_pago_production", {
          env: {
            VERCEL_ENV: "production",
            DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "false",
          },
        }),
      /LIVE_PAYMENTS_DISABLED/,
    );
  });

  it("PROD + LIVE flag ON → mercado_pago_production", () => {
    const mode = resolveClickatonPaymentsProviderModeControlled("mercado_pago_production", {
      env: {
        VERCEL_ENV: "production",
        DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "true",
      },
    });
    assert.equal(mode, "mercado_pago_production");
  });

  it("STAGING + production provider → mercado_pago_production_forbidden", () => {
    assert.throws(
      () =>
        resolveClickatonPaymentsProviderModeControlled("mercado_pago_production", {
          env: {
            VERCEL_ENV: "preview",
            DNX_ENVIRONMENT: "staging",
            DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "true",
          },
        }),
      /mercado_pago_production_forbidden/,
    );
  });

  it("TEST mode still works", () => {
    assert.equal(
      resolveClickatonPaymentsProviderModeControlled("mercado_pago_test", {
        env: { VERCEL_ENV: "preview" },
      }),
      "mercado_pago_test",
    );
  });

  it("execution gate rejects production env without LIVE bridge", () => {
    const r = assertLivePaymentsExecutionAllowed({
      bridgeMode: "mercado_pago_test",
      environment: "production",
      liveFlagEnabled: true,
      productionRuntime: true,
    });
    assert.equal(r.ok, false);
  });

  it("preflight READY_CONFIGURATION with LIVE_FLAG_OFF", () => {
    const r = preflightClickatonLivePayments({
      env: {
        VERCEL_ENV: "production",
        CLICKATON_DNX_PAYMENTS_PROVIDER: "mercado_pago_production",
        DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "false",
        CLICKATON_PUBLIC_URL: "https://maratonfotografica.com",
        DNX_PAYMENTS_WEBHOOK_PUBLIC_URL:
          "https://maratonfotografica.com/api/webhooks/dnx-payments",
        DNX_FINANCIAL_CREDENTIAL_MASTER_KEY: "x".repeat(32),
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
    assert.equal(r.configuration, "READY_CONFIGURATION");
    assert.equal(r.liveExecution, "OFF");
    assert.equal(r.providerResolveError, "LIVE_PAYMENTS_DISABLED");
    assert.equal(r.projected.amountArs, 25000);
    assert.equal(r.projected.charge, "NONE_PREFLIGHT");
  });

  it("allocation != 100 → reject config", () => {
    const r = preflightClickatonLivePayments({
      env: {
        VERCEL_ENV: "production",
        CLICKATON_PUBLIC_URL: "https://maratonfotografica.com",
        DNX_PAYMENTS_WEBHOOK_PUBLIC_URL:
          "https://maratonfotografica.com/api/webhooks/dnx-payments",
      },
      allocationSumPercent: 80,
      recipientEmail: "dnxfotografia@gmail.com",
      recipientPaymentAccountId: "pa_x",
      recipientAccountStatus: "ACTIVE",
      recipientAccountEnvironment: "PROD",
    });
    assert.equal(r.configuration, "CONFIGURATION_INCOMPLETE");
    assert.equal(r.checks.allocation100, "FAIL");
  });

  it("owner invariant fail", () => {
    const r = preflightClickatonLivePayments({
      env: {
        VERCEL_ENV: "production",
        CLICKATON_PUBLIC_URL: "https://maratonfotografica.com",
        DNX_PAYMENTS_WEBHOOK_PUBLIC_URL:
          "https://maratonfotografica.com/api/webhooks/dnx-payments",
      },
      allocationSumPercent: 100,
      ownerPaymentAccountIdExpected: "pa_owner",
      ownerPaymentAccountIdActual: "pa_other",
    });
    assert.equal(r.checks.ownerInvariant, "FAIL");
  });

  it("helpers", () => {
    assert.equal(isClickatonProductionRuntime({ VERCEL_ENV: "production" }), true);
    assert.equal(isClickatonLivePaymentsEnabled({}), false);
    assert.equal(
      isClickatonLivePaymentsEnabled({ DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED: "1" }),
      true,
    );
  });
});
