import test from "node:test";
import assert from "node:assert/strict";
import {
  checkCollectionSecret,
  countryMismatchMessage,
  checkFailureMessage,
} from "./collection-check";

type Call = { url: string; init: RequestInit | undefined };

function fakeFetch(status: number, body: unknown, calls: Call[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

const mp = { provider: "MERCADOPAGO_OWN" as const, accessToken: "APP_USR-secret-token" };
const pp = {
  provider: "PAYPAL_OWN" as const,
  clientId: "AaBbCcDdEeFfGgHhIiJj1234",
  clientSecret: "SECRET-secret-secret-1",
};

test("Mercado Pago 200 devuelve la cuenta y el país", async () => {
  const calls: Call[] = [];
  const r = await checkCollectionSecret(
    mp,
    "PROD",
    fakeFetch(200, { id: 123, nickname: "FOTOMX", site_id: "MLM" }, calls),
  );
  assert.deepEqual(r, { ok: true, accountId: "123", accountLabel: "FOTOMX", accountCountryCode: "MX" });
  assert.equal(calls[0].url, "https://api.mercadopago.com/users/me");
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(headers.get("Authorization"), "Bearer APP_USR-secret-token");
});
test("Mercado Pago usa el email si falta el nickname y country_id si el site_id no está", async () => {
  const r = await checkCollectionSecret(
    mp,
    "PROD",
    fakeFetch(200, { id: 5, email: "a@b.com", site_id: "XXX", country_id: "PA" }),
  );
  assert.deepEqual(r, { ok: true, accountId: "5", accountLabel: "a@b.com", accountCountryCode: "PA" });
});
test("Mercado Pago sin nickname ni email usa una etiqueta genérica", async () => {
  const r = await checkCollectionSecret(mp, "PROD", fakeFetch(200, { id: 5 }));
  assert.deepEqual(r, { ok: true, accountId: "5", accountLabel: "Cuenta de Mercado Pago", accountCountryCode: null });
});
test("Mercado Pago 401 y 403 son credenciales inválidas", async () => {
  for (const status of [401, 403]) {
    assert.deepEqual(await checkCollectionSecret(mp, "PROD", fakeFetch(status, {})), {
      ok: false,
      reason: "INVALID_CREDENTIALS",
    });
  }
});
test("Mercado Pago 500 o error de red es proveedor no disponible", async () => {
  assert.deepEqual(await checkCollectionSecret(mp, "PROD", fakeFetch(500, {})), {
    ok: false,
    reason: "PROVIDER_UNAVAILABLE",
  });
  const boom = (async () => {
    throw new Error("boom APP_USR-secret-token");
  }) as typeof fetch;
  assert.deepEqual(await checkCollectionSecret(mp, "PROD", boom), {
    ok: false,
    reason: "PROVIDER_UNAVAILABLE",
  });
});
test("PayPal PROD llama al endpoint real con Basic auth", async () => {
  const calls: Call[] = [];
  const r = await checkCollectionSecret(pp, "PROD", fakeFetch(200, { app_id: "APP-80W" }, calls));
  assert.deepEqual(r, {
    ok: true,
    accountId: "APP-80W",
    accountLabel: "App de PayPal ···1234",
    accountCountryCode: null,
  });
  assert.equal(calls[0].url, "https://api-m.paypal.com/v1/oauth2/token");
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(calls[0].init?.body, "grant_type=client_credentials");
  const headers = new Headers(calls[0].init?.headers);
  assert.equal(
    headers.get("Authorization"),
    "Basic " + Buffer.from(`${pp.clientId}:${pp.clientSecret}`).toString("base64"),
  );
});
test("PayPal TEST llama a sandbox", async () => {
  const calls: Call[] = [];
  await checkCollectionSecret(pp, "TEST", fakeFetch(200, {}, calls));
  assert.equal(calls[0].url, "https://api-m.sandbox.paypal.com/v1/oauth2/token");
});
test("PayPal 200 sin app_id deja accountId en null", async () => {
  const r = await checkCollectionSecret(pp, "PROD", fakeFetch(200, {}));
  assert.equal(r.ok && r.accountId, null);
});
test("PayPal 401 es inválido y 500 no disponible", async () => {
  assert.deepEqual(await checkCollectionSecret(pp, "PROD", fakeFetch(401, {})), {
    ok: false,
    reason: "INVALID_CREDENTIALS",
  });
  assert.deepEqual(await checkCollectionSecret(pp, "PROD", fakeFetch(500, {})), {
    ok: false,
    reason: "PROVIDER_UNAVAILABLE",
  });
});
test("checkFailureMessage", () => {
  assert.equal(
    checkFailureMessage("INVALID_CREDENTIALS", "MERCADOPAGO_OWN"),
    "Mercado Pago rechazó esas credenciales. Revisá que sea el Access Token de producción de tu aplicación.",
  );
  assert.equal(
    checkFailureMessage("INVALID_CREDENTIALS", "PAYPAL_OWN"),
    "PayPal rechazó esas credenciales. Revisá el Client ID y el Secret de tu app Live.",
  );
  assert.equal(
    checkFailureMessage("PROVIDER_UNAVAILABLE", "PAYPAL_OWN"),
    "No pudimos comprobar la conexión ahora. Probá de nuevo en unos minutos.",
  );
});
test("countryMismatchMessage", () => {
  assert.equal(
    countryMismatchMessage("MX", "BR"),
    "Esta cuenta de Mercado Pago es de Brasil y tu país es México. Conectá la cuenta del país donde vendés.",
  );
  assert.equal(countryMismatchMessage("MX", "MX"), null);
  assert.equal(countryMismatchMessage("MX", null), null);
});
