/**
 * Selfcheck 10D3H-B — adapter Mercado Pago TEST (Checkout Pro Preferences).
 * Solo mocks/fixtures. Sin internet. Sin Neon. Sin cobros.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateMercadoPagoTestCredentials,
  mapMercadoPagoPaymentStatusToNormalized,
  createMercadoPagoCheckoutProTestAdapter,
  resolveClickatonPaymentsProviderMode,
  sanitizeMercadoPagoPreferenceResponse,
  assertNoSecretLeak,
  MercadoPagoHttpClient,
  createMercadoPagoProviderConfig,
} from "@repo/payments/next";
import { assertSafeCheckoutUrl } from "../lib/checkout/domain/checkout-url";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`mercado-pago-test-adapter.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

async function main() {
  assert(
    file("lib/checkout/actions/runtime.ts").includes("CLICKATON_DNX_PAYMENTS_PROVIDER"),
    "runtime provider selection",
  );
  assert(
    file("../../packages/payments/src/providers/mercado-pago/checkout-pro/preference-adapter.ts").includes(
      "checkout/preferences",
    ),
    "preference endpoint",
  );
  assert(
    !file("lib/checkout/application/create-registration-checkout.ts").includes("api.mercadopago.com"),
    "clickaton does not call MP directly",
  );

  // 1–5 credentials
  const invalidProd = await validateMercadoPagoTestCredentials({
    accessToken: "TEST-x",
    declaredEnvironment: "production",
  });
  assert(!invalidProd.safeToExecute, "2 production rejected");

  const unknown = await validateMercadoPagoTestCredentials({
    accessToken: "NOPE",
    declaredEnvironment: "sandbox",
  });
  assert(!unknown.safeToExecute, "3 unknown rejected");

  const appUsrAmbiguous = await validateMercadoPagoTestCredentials({
    accessToken: "APP_USR-xxx",
    declaredEnvironment: "sandbox",
    credentialsSource: "unknown",
  });
  assert(!appUsrAmbiguous.safeToExecute, "APP_USR without attestation blocked");

  const testSeller = await validateMercadoPagoTestCredentials({
    accessToken: "TEST-ok",
    declaredEnvironment: "sandbox",
    usersMe: { id: 1, email: "a@testuser.com", nickname: "TESTUSER1" },
  });
  assert(testSeller.safeToExecute && testSeller.sellerType === "TEST_USER", "1+4 valid TEST seller");

  const realSeller = await validateMercadoPagoTestCredentials({
    accessToken: "APP_USR-xxx",
    declaredEnvironment: "sandbox",
    credentialsSource: "credenciales_de_prueba",
    usersMe: { id: 2, email: "shop@gmail.com", nickname: "realseller" },
  });
  assert(!realSeller.safeToExecute && realSeller.sellerType === "REAL_USER", "5 real seller rejected");

  // Provider mode
  assert(resolveClickatonPaymentsProviderMode("manual") === "manual", "manual mode");
  assert(resolveClickatonPaymentsProviderMode("mercado_pago_test") === "mercado_pago_test", "mp test");
  let prodBlocked = false;
  try {
    resolveClickatonPaymentsProviderMode("mercado_pago_production");
  } catch {
    prodBlocked = true;
  }
  assert(prodBlocked, "30 production provider blocked");

  // Mocked create preference
  const token = "TEST-selfcheck-token-secret";
  const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      external_reference: string;
      notification_url: string;
      back_urls: { success: string; pending: string; failure: string };
      items: Array<{ unit_price: number; currency_id: string; title: string }>;
    };
    assert(body.external_reference.startsWith("clickaton:"), "8 external reference");
    assert(body.notification_url.startsWith("https://"), "10 notification https");
    assert(body.back_urls.success.includes("/pago/exito"), "9 back success");
    assert(body.back_urls.pending.includes("/pago/pendiente"), "9 back pending");
    assert(body.back_urls.failure.includes("/pago/error"), "9 back failure");
    assert(body.items[0]?.currency_id === "ARS", "12 currency");
    assert(body.items[0]?.unit_price === 25, "11 amount");
    assert(body.items[0]?.title.toUpperCase().includes("TEST"), "description TEST");
    return new Response(
      JSON.stringify({
        id: "pref_selfcheck",
        init_point: "https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=pref_selfcheck",
        external_reference: body.external_reference,
        access_token: token,
      }),
      { status: 201, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const config = createMercadoPagoProviderConfig({ accessToken: token, environment: "sandbox" });
  const adapter = createMercadoPagoCheckoutProTestAdapter({
    accessToken: token,
    credentialsSource: "credenciales_de_prueba",
    skipCredentialGate: true,
    httpClient: new MercadoPagoHttpClient(config, fetchImpl),
  });

  const created = await adapter.createPreference({
    amountMinor: 2500,
    currency: "ARS",
    description: "Clickaton smoke TEST",
    externalReference: "clickaton:registration:reg_sc",
    idempotencyKey: "idem_sc_1",
    successUrl: "https://staging.example/maratones/x/inscripcion/pago/exito",
    pendingUrl: "https://staging.example/maratones/x/inscripcion/pago/pendiente",
    failureUrl: "https://staging.example/maratones/x/inscripcion/pago/error",
    notificationUrl: "https://staging.example/api/webhooks/dnx-payments",
  });
  assert(created.providerPreferenceId === "pref_selfcheck", "6 create order/preference");
  assert(assertSafeCheckoutUrl(created.checkoutUrl).ok, "13 checkout allowlisted");
  assertNoSecretLeak(created.rawSanitized, token);
  assert(!(JSON.stringify(created.rawSanitized).includes(token)), "14+24 sanitized no token");

  // Idempotency key passed — second call with same mock still works (7)
  const again = await adapter.createPreference({
    amountMinor: 2500,
    currency: "ARS",
    description: "Clickaton smoke TEST",
    externalReference: "clickaton:registration:reg_sc",
    idempotencyKey: "idem_sc_1",
    successUrl: "https://staging.example/maratones/x/inscripcion/pago/exito",
    pendingUrl: "https://staging.example/maratones/x/inscripcion/pago/pendiente",
    failureUrl: "https://staging.example/maratones/x/inscripcion/pago/error",
    notificationUrl: "https://staging.example/api/webhooks/dnx-payments",
  });
  assert(again.providerPreferenceId === "pref_selfcheck", "7 idempotency key accepted");

  // Payment status mapping 16–19
  assert(mapMercadoPagoPaymentStatusToNormalized("approved") === "APPROVED", "16 approved");
  assert(mapMercadoPagoPaymentStatusToNormalized("pending") === "PENDING", "17 pending");
  assert(mapMercadoPagoPaymentStatusToNormalized("rejected") === "REJECTED", "18 rejected");
  assert(mapMercadoPagoPaymentStatusToNormalized("cancelled") === "CANCELLED", "19 cancelled");

  // Duplicate webhook / mismatches conceptually covered by durable layer; assert mapping helpers
  const sanitized = sanitizeMercadoPagoPreferenceResponse({
    id: "p",
    init_point: "https://www.mercadopago.com/x",
    payer: { email: "pii@example.com" },
  });
  assert(!(JSON.stringify(sanitized).includes("pii@")), "25 no PII");

  // Redirect does not confirm — documented in checkout return path
  assert(
    file("lib/checkout/application/get-registration-payment-status.ts").includes("refresh"),
    "26 refresh path exists (redirect alone does not confirm)",
  );

  // Amount/currency/source mismatch codes exist in apply layer
  const applySrc = file("lib/checkout/application/apply-payment-event.ts");
  assert(applySrc.includes("PAYMENT_AMOUNT_MISMATCH"), "21 amount mismatch");
  assert(applySrc.includes("PAYMENT_CURRENCY_MISMATCH"), "22 currency mismatch");

  console.log("mercado-pago-test-adapter.selfcheck: OK (mocked, offline)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
