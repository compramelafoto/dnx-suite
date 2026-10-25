import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";

import { openRefreshToken, sealRefreshToken, vaultKeyFromEnv } from "./token-vault";

const KEY = randomBytes(32).toString("base64");

test("lo que se cifra se puede descifrar con la misma clave", () => {
  const sealed = sealRefreshToken("1//token-de-prueba", KEY);
  assert.equal(openRefreshToken(sealed, KEY), "1//token-de-prueba");
});

test("el token no queda legible en lo guardado", () => {
  assert.equal(sealRefreshToken("1//token-de-prueba", KEY).includes("token-de-prueba"), false);
});

test("con otra clave no se puede abrir", () => {
  const sealed = sealRefreshToken("1//token-de-prueba", KEY);
  assert.throws(() => openRefreshToken(sealed, randomBytes(32).toString("base64")));
});

test("sin la variable de entorno avisa cuál falta", () => {
  assert.throws(() => vaultKeyFromEnv({}), /FINANCE_MAIL_VAULT_KEY/);
  assert.equal(vaultKeyFromEnv({ FINANCE_MAIL_VAULT_KEY: KEY }), KEY);
});
