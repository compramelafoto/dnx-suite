import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanCollectionSecret,
  validateCollectionSecret,
  collectionSecretLast4,
  resolveIntlPaymentsEnvironment,
} from "./collection-secret";

test("cleanCollectionSecret recorta espacios y saltos de Mercado Pago", () => {
  assert.deepEqual(
    cleanCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "  APP_USR-123\n" }),
    { provider: "MERCADOPAGO_OWN", accessToken: "APP_USR-123" },
  );
});
test("cleanCollectionSecret recorta PayPal", () => {
  assert.deepEqual(
    cleanCollectionSecret({ provider: "PAYPAL_OWN", clientId: " a \n", clientSecret: "\tb " }),
    { provider: "PAYPAL_OWN", clientId: "a", clientSecret: "b" },
  );
});
test("cleanCollectionSecret devuelve null si falta algo o el proveedor es desconocido", () => {
  assert.equal(cleanCollectionSecret({ provider: "PAYPAL_OWN", clientId: "a", clientSecret: "" }), null);
  assert.equal(cleanCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "   " }), null);
  assert.equal(cleanCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: 5 }), null);
  assert.equal(cleanCollectionSecret({ provider: "STRIPE" }), null);
  assert.equal(cleanCollectionSecret(null), null);
  assert.equal(cleanCollectionSecret("x"), null);
});
test("validateCollectionSecret en PROD rechaza token de prueba", () => {
  assert.equal(
    validateCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "TEST-1234567890" }, "PROD"),
    "Ese es un token de prueba. Pegá el Access Token de producción, que empieza con APP_USR-.",
  );
});
test("validateCollectionSecret en PROD rechaza formato inválido y acepta APP_USR-", () => {
  assert.equal(
    validateCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "abc" }, "PROD"),
    "El Access Token no tiene el formato de Mercado Pago (empieza con APP_USR-).",
  );
  assert.equal(validateCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "APP_USR-abcd9876" }, "PROD"), null);
});
test("validateCollectionSecret en TEST acepta TEST-", () => {
  assert.equal(validateCollectionSecret({ provider: "MERCADOPAGO_OWN", accessToken: "TEST-1234567890" }, "TEST"), null);
});
test("validateCollectionSecret de PayPal exige al menos 20 caracteres", () => {
  const msg = "El Client ID y el Secret de PayPal parecen incompletos. Copialos de nuevo desde tu app Live.";
  const ok = "x".repeat(20);
  assert.equal(validateCollectionSecret({ provider: "PAYPAL_OWN", clientId: "corto", clientSecret: ok }, "PROD"), msg);
  assert.equal(validateCollectionSecret({ provider: "PAYPAL_OWN", clientId: ok, clientSecret: "corto" }, "PROD"), msg);
  assert.equal(validateCollectionSecret({ provider: "PAYPAL_OWN", clientId: ok, clientSecret: ok }, "PROD"), null);
});
test("collectionSecretLast4", () => {
  assert.equal(collectionSecretLast4({ provider: "MERCADOPAGO_OWN", accessToken: "APP_USR-abcd9876" }), "9876");
  assert.equal(collectionSecretLast4({ provider: "PAYPAL_OWN", clientId: "idclient1234", clientSecret: "secretoxxxx" }), "1234");
});
test("resolveIntlPaymentsEnvironment", () => {
  assert.equal(resolveIntlPaymentsEnvironment({ CLF_INTL_PAYMENTS_ENV: "TEST", NODE_ENV: "production" }), "TEST");
  assert.equal(resolveIntlPaymentsEnvironment({ CLF_INTL_PAYMENTS_ENV: "PROD", NODE_ENV: "development" }), "PROD");
  assert.equal(resolveIntlPaymentsEnvironment({ NODE_ENV: "development" }), "TEST");
  assert.equal(resolveIntlPaymentsEnvironment({ NODE_ENV: "production" }), "PROD");
  assert.equal(resolveIntlPaymentsEnvironment({}), "TEST");
});
