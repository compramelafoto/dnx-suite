import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  opcionesCookieReferido,
} from "./cookie";

test("la cookie dura 90 días", () => {
  assert.equal(REFERRAL_COOKIE_MAX_AGE_SECONDS, 90 * 24 * 60 * 60);
});

test("la cookie no es legible desde JavaScript ni viaja entre sitios", () => {
  const opts = opcionesCookieReferido();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
});

test("en producción la cookie exige HTTPS", () => {
  assert.equal(opcionesCookieReferido("production").secure, true);
});

test("en desarrollo no exige HTTPS, porque next dev sirve por HTTP", () => {
  assert.equal(opcionesCookieReferido("development").secure, false);
});

test("el nombre de la cookie es estable", () => {
  // Cambiarlo tira a la basura las atribuciones en curso de todo el que ya
  // tiene el link abierto.
  assert.equal(REFERRAL_COOKIE_NAME, "ck_ref");
});
