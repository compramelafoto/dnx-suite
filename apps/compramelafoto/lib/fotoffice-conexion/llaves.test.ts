/**
 * pnpm --filter compramelafoto test:fotoffice-vinculo
 *
 * Llaves y códigos de la conexión con FOTOFFICE: hash, secreto compartido y lista blanca de la URL de vuelta.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PREFIJO_LLAVE,
  RETORNO_POR_OMISION,
  bearerDe,
  generarSecreto,
  hashSecreto,
  recortarNombreEspacio,
  retornoPermitido,
  secretoCoincide,
  urlDeVuelta,
} from "./llaves";

const PROD = { NODE_ENV: "production" } as const;

test("hashSecreto es determinista y da hex de 64 caracteres", () => {
  const a = hashSecreto("clf_fo_abc");
  assert.equal(a, hashSecreto("clf_fo_abc"));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, hashSecreto("clf_fo_abd"));
});

test("generarSecreto: 32 bytes en base64url, con prefijo opcional y siempre distinto", () => {
  const codigo = generarSecreto();
  assert.match(codigo, /^[A-Za-z0-9_-]{43}$/);
  const llave = generarSecreto(PREFIJO_LLAVE);
  assert.ok(llave.startsWith("clf_fo_"));
  assert.equal(llave.length, "clf_fo_".length + 43);
  assert.notEqual(generarSecreto(), generarSecreto());
});

test("secretoCoincide compara sin cortar por el largo", () => {
  assert.equal(secretoCoincide("s3creto-largo", "s3creto-largo"), true);
  assert.equal(secretoCoincide("s3creto-larg", "s3creto-largo"), false);
  assert.equal(secretoCoincide("", "s3creto-largo"), false);
  assert.equal(secretoCoincide("s3creto-largo", ""), false);
  assert.equal(secretoCoincide("x".repeat(5000), "s3creto-largo"), false);
});

test("bearerDe lee el encabezado Authorization", () => {
  assert.equal(bearerDe("Bearer abc"), "abc");
  assert.equal(bearerDe("bearer   abc  "), "abc");
  assert.equal(bearerDe("Basic abc"), null);
  assert.equal(bearerDe("Bearer "), null);
  assert.equal(bearerDe(null), null);
});

test("retornoPermitido acepta exactamente las URL de la lista", () => {
  const env = { ...PROD, FOTOFFICE_CONNECT_RETURN_URLS: " https://fotoffice.com/api/integraciones/clf/callback , https://dnx.fotoffice.com/api/integraciones/clf/callback " };
  assert.equal(retornoPermitido("https://fotoffice.com/api/integraciones/clf/callback", env), true);
  assert.equal(retornoPermitido("https://dnx.fotoffice.com/api/integraciones/clf/callback", env), true);
});

test("retornoPermitido rechaza variantes de una URL permitida", () => {
  const env = { ...PROD, FOTOFFICE_CONNECT_RETURN_URLS: "https://fotoffice.com/api/integraciones/clf/callback" };
  for (const url of [
    "https://otro.com/api/integraciones/clf/callback",
    "https://fotoffice.com.otro.com/api/integraciones/clf/callback",
    "http://fotoffice.com/api/integraciones/clf/callback",
    "https://fotoffice.com/api/integraciones/clf/callback/extra",
    "https://fotoffice.com/api/integraciones/clf/callback?",
    "https://fotoffice.com/api/integraciones/clf/callback?x=1",
    "https://fotoffice.com/api/integraciones/clf/callback#x",
    "https://fotoffice.com/api/integraciones/clf/callback/",
    "https://FOTOFFICE.com/api/integraciones/clf/callback",
    " https://fotoffice.com/api/integraciones/clf/callback",
    "",
  ]) {
    assert.equal(retornoPermitido(url, env), false, url);
  }
});

test("sin lista configurada, en producción acepta sólo la URL por omisión", () => {
  assert.equal(RETORNO_POR_OMISION, "https://fotoffice.com/api/integraciones/clf/callback");
  assert.equal(retornoPermitido(RETORNO_POR_OMISION, PROD), true);
  assert.equal(retornoPermitido("http://localhost:3000/api/integraciones/clf/callback", PROD), false);
  assert.equal(retornoPermitido("https://dnx.fotoffice.com/api/integraciones/clf/callback", PROD), false);
  assert.equal(retornoPermitido(RETORNO_POR_OMISION, { ...PROD, FOTOFFICE_CONNECT_RETURN_URLS: " , " }), true);
});

test("con env vacío acepta la URL por omisión; en desarrollo, además localhost", () => {
  assert.equal(retornoPermitido(RETORNO_POR_OMISION, {}), true);
  const dev = { NODE_ENV: "development" };
  assert.equal(retornoPermitido("http://localhost:3000/api/integraciones/clf/callback", dev), true);
  assert.equal(retornoPermitido("http://localhost:3105/api/integraciones/clf/callback", dev), true);
  assert.equal(retornoPermitido("http://localhost/api/integraciones/clf/callback", dev), false);
  assert.equal(retornoPermitido("http://localhost:3000/api/integraciones/clf/callback?x=1", dev), false);
  assert.equal(retornoPermitido("http://localhost.otro.com:3000/api/integraciones/clf/callback", dev), false);
  assert.equal(retornoPermitido("http://127.0.0.1:3000/api/integraciones/clf/callback", dev), false);
});

test("recortarNombreEspacio limpia y corta a 80 caracteres", () => {
  assert.equal(recortarNombreEspacio("  DNX   Estudio \n"), "DNX Estudio");
  assert.equal(recortarNombreEspacio("x".repeat(200)).length, 80);
  assert.equal(recortarNombreEspacio(""), "");
  assert.equal(recortarNombreEspacio(undefined), "");
});

test("urlDeVuelta agrega los parámetros a la URL permitida", () => {
  assert.equal(
    urlDeVuelta(RETORNO_POR_OMISION, { code: "a b", state: "s&t" }),
    "https://fotoffice.com/api/integraciones/clf/callback?code=a+b&state=s%26t",
  );
});
