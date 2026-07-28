import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MercadoPagoHttpClient } from "../client/mercado-pago-http-client";
import { createMercadoPagoProviderConfig } from "../client/mercado-pago-environment";
import { validateMercadoPagoTestCredentials } from "./validate-credentials";
import { MercadoPagoCheckoutProTestAdapter } from "./preference-adapter";
import { mapMercadoPagoPaymentStatusToNormalized } from "./map-status";
import { sanitizeMercadoPagoPreferenceResponse, assertNoSecretLeak } from "./sanitize";
import {
  createMercadoPagoTestClickatonProviderBridge,
  resolveClickatonPaymentsProviderMode,
} from "./provider-bridge";

describe("validateMercadoPagoTestCredentials", () => {
  it("rejects missing token", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "",
      declaredEnvironment: "sandbox",
    });
    assert.equal(r.safeToExecute, false);
    assert.equal(r.reason, "access_token_absent");
  });

  it("rejects production declared environment", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "TEST-abc",
      declaredEnvironment: "production",
    });
    assert.equal(r.environment, "PRODUCTION");
    assert.equal(r.safeToExecute, false);
  });

  it("rejects unknown prefix", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "PROD-xyz",
      declaredEnvironment: "sandbox",
    });
    assert.equal(r.safeToExecute, false);
  });

  it("TEST- without seller verification is not safe", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "TEST-abc123",
      declaredEnvironment: "sandbox",
    });
    assert.equal(r.environment, "TEST");
    assert.equal(r.safeToExecute, false);
    assert.equal(r.reason, "test_prefix_seller_unverified");
  });

  it("TEST- with test seller is safe", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "TEST-abc123",
      declaredEnvironment: "sandbox",
      usersMe: { id: 1, email: "buyer@testuser.com", nickname: "TESTUSER123" },
    });
    assert.equal(r.safeToExecute, true);
    assert.equal(r.sellerType, "TEST_USER");
  });

  it("APP_USR without attestation is blocked", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "APP_USR-abc",
      declaredEnvironment: "sandbox",
      credentialsSource: "unknown",
      usersMe: { id: 1, email: "x@testuser.com", nickname: "TESTUSER" },
    });
    assert.equal(r.safeToExecute, false);
    assert.match(r.reason, /attestation/);
  });

  it("APP_USR attested + test seller is safe", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "APP_USR-abc",
      declaredEnvironment: "sandbox",
      credentialsSource: "credenciales_de_prueba",
      usersMe: { id: 9, email: "seller@testuser.com", nickname: "TESTUSER99", site_id: "MLA" },
    });
    assert.equal(r.safeToExecute, true);
    assert.equal(r.environment, "TEST");
  });

  it("APP_USR attested + real seller is blocked as production risk", async () => {
    const r = await validateMercadoPagoTestCredentials({
      accessToken: "APP_USR-abc",
      declaredEnvironment: "sandbox",
      credentialsSource: "credenciales_de_prueba",
      usersMe: { id: 9, email: "real@gmail.com", nickname: "realshop" },
    });
    assert.equal(r.safeToExecute, false);
    assert.equal(r.sellerType, "REAL_USER");
  });
});

describe("mapMercadoPagoPaymentStatusToNormalized", () => {
  it("maps core statuses", () => {
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("pending"), "PENDING");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("in_process"), "PROCESSING");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("approved"), "APPROVED");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("rejected"), "REJECTED");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("cancelled"), "CANCELLED");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("refunded"), "REFUNDED");
    assert.equal(mapMercadoPagoPaymentStatusToNormalized("charged_back"), "CHARGEBACK");
  });
});

describe("MercadoPagoCheckoutProTestAdapter", () => {
  const token = "TEST-unit-token-do-not-leak";

  function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return handler(url, init);
    }) as typeof fetch;
  }

  it("creates preference with idempotency, back urls and sanitized response", async () => {
    const fetchImpl = mockFetch(async (url, init) => {
      assert.match(url, /\/checkout\/preferences$/);
      assert.equal(init?.method, "POST");
      const headers = init?.headers as Record<string, string>;
      assert.ok(String(headers.Authorization ?? headers.authorization).includes("Bearer"));
      assert.ok(headers["X-Idempotency-Key"] || headers["x-idempotency-key"]);
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        external_reference: string;
        notification_url: string;
        back_urls: { success: string };
        items: Array<{ unit_price: number; currency_id: string }>;
      };
      assert.equal(body.external_reference, "clickaton:registration:reg1");
      assert.equal(body.notification_url, "https://staging.example/api/webhooks/dnx-payments");
      assert.match(body.back_urls.success, /^https:\/\//);
      assert.equal(body.items[0]?.currency_id, "ARS");
      assert.equal(body.items[0]?.unit_price, 15);
      return new Response(
        JSON.stringify({
          id: "pref-1",
          init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-1",
          external_reference: body.external_reference,
          access_token: token,
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });

    const config = createMercadoPagoProviderConfig({ accessToken: token, environment: "sandbox" });
    const http = new MercadoPagoHttpClient(config, fetchImpl);
    const adapter = new MercadoPagoCheckoutProTestAdapter({
      config,
      httpClient: http,
      credentialsSource: "credenciales_de_prueba",
      skipCredentialGate: true,
    });

    const created = await adapter.createPreference({
      amountMinor: 1500,
      currency: "ARS",
      description: "Clickaton ENTRY TEST",
      externalReference: "clickaton:registration:reg1",
      idempotencyKey: "idem-1",
      successUrl: "https://staging.example/ok",
      pendingUrl: "https://staging.example/pending",
      failureUrl: "https://staging.example/err",
      notificationUrl: "https://staging.example/api/webhooks/dnx-payments",
    });

    assert.equal(created.providerPreferenceId, "pref-1");
    assert.match(created.checkoutUrl, /^https:\/\/www\.mercadopago\.com\.ar\//);
    assert.equal(created.rawSanitized.access_token, undefined);
    assertNoSecretLeak(created.rawSanitized, token);
  });

  it("blocks create without credential gate when APP_USR ambiguous", async () => {
    const config = createMercadoPagoProviderConfig({
      accessToken: "APP_USR-ambiguous",
      environment: "sandbox",
    });
    const fetchImpl = mockFetch(async () => {
      return new Response(JSON.stringify({ id: 1, email: "x@gmail.com", nickname: "shop" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const adapter = new MercadoPagoCheckoutProTestAdapter({
      config,
      httpClient: new MercadoPagoHttpClient(config, fetchImpl),
      credentialsSource: "unknown",
    });
    await assert.rejects(
      () =>
        adapter.createPreference({
          amountMinor: 100,
          currency: "ARS",
          description: "TEST",
          externalReference: "x",
          idempotencyKey: "k",
          successUrl: "https://a/ok",
          pendingUrl: "https://a/p",
          failureUrl: "https://a/e",
          notificationUrl: "https://a/hook",
        }),
      /mp_test_credentials_blocked/,
    );
  });

  it("getPayment maps approved and rejects live_mode for smoke safety", async () => {
    const fetchImpl = mockFetch(async () => {
      return new Response(
        JSON.stringify({
          id: 99,
          status: "approved",
          transaction_amount: 15,
          currency_id: "ARS",
          external_reference: "clickaton:registration:reg1",
          live_mode: false,
          payer: { email: "secret@example.com" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const config = createMercadoPagoProviderConfig({ accessToken: token, environment: "sandbox" });
    const adapter = new MercadoPagoCheckoutProTestAdapter({
      config,
      httpClient: new MercadoPagoHttpClient(config, fetchImpl),
      skipCredentialGate: true,
    });
    const payment = await adapter.getPayment("99");
    assert.equal(payment.status, "APPROVED");
    assert.equal(payment.amountMinor, 1500);
    assert.equal(payment.liveMode, false);
    assert.equal((payment.rawSanitized as { payer?: unknown }).payer, undefined);
  });

  it("searchPaymentsByExternalReference prefers approved result", async () => {
    const fetchImpl = mockFetch(async (url) => {
      assert.match(url, /\/v1\/payments\/search/);
      assert.match(url, /external_reference=/);
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 10,
              status: "pending",
              transaction_amount: 15,
              currency_id: "ARS",
              external_reference: "clickaton:registration:reg1",
              live_mode: false,
              date_created: "2026-01-01T10:00:00.000Z",
            },
            {
              id: 11,
              status: "approved",
              transaction_amount: 15,
              currency_id: "ARS",
              external_reference: "clickaton:registration:reg1",
              live_mode: false,
              date_created: "2026-01-01T11:00:00.000Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const config = createMercadoPagoProviderConfig({ accessToken: token, environment: "sandbox" });
    const adapter = new MercadoPagoCheckoutProTestAdapter({
      config,
      httpClient: new MercadoPagoHttpClient(config, fetchImpl),
      skipCredentialGate: true,
    });
    const payment = await adapter.searchPaymentsByExternalReference("clickaton:registration:reg1");
    assert.ok(payment);
    assert.equal(payment!.providerPaymentId, "11");
    assert.equal(payment!.status, "APPROVED");
  });

  it("refreshCheckout returns pending when providerOrderId is preference id", async () => {
    const fetchImpl = mockFetch(async (url) => {
      if (url.includes("/checkout/preferences/pref-non-numeric")) {
        return new Response(
          JSON.stringify({
            id: "pref-non-numeric",
            external_reference: "ext-1",
            init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref-non-numeric",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      throw new Error(`unexpected_url:${url}`);
    });
    const config = createMercadoPagoProviderConfig({ accessToken: token, environment: "sandbox" });
    const adapter = new MercadoPagoCheckoutProTestAdapter({
      config,
      httpClient: new MercadoPagoHttpClient(config, fetchImpl),
      skipCredentialGate: true,
    });
    const bridge = createMercadoPagoTestClickatonProviderBridge({ adapter });
    assert.ok(bridge.refreshCheckout);
    const refreshed = await bridge.refreshCheckout!({
      providerOrderId: "pref-non-numeric",
      externalReference: "ext-1",
      expectedAmountMinor: 1000,
      expectedCurrency: "ARS",
    });
    assert.ok(refreshed);
    assert.equal(refreshed!.status, "PENDING");
    assert.equal(refreshed!.amountMinor, 1000);
    assert.equal(refreshed!.liveMode, false);
  });

  it("sanitize strips secrets", () => {
    const s = sanitizeMercadoPagoPreferenceResponse({
      id: "p",
      init_point: "https://www.mercadopago.com/x",
      access_token: token,
      payer: { email: "a@b.com" },
    });
    assert.equal((s as { access_token?: unknown }).access_token, undefined);
    assert.equal((s as { payer?: unknown }).payer, undefined);
  });
});

describe("resolveClickatonPaymentsProviderMode", () => {
  it("defaults and forbids production", () => {
    assert.equal(resolveClickatonPaymentsProviderMode(undefined), "manual");
    assert.equal(resolveClickatonPaymentsProviderMode("mercado_pago_test"), "mercado_pago_test");
    assert.throws(() => resolveClickatonPaymentsProviderMode("mercado_pago_production"));
  });
});
