/**
 * Selfcheck — orden canónico y contratos de marca (sin DOM React).
 * pnpm --filter @repo/auth-ui selfcheck
 */

import assert from "node:assert/strict";
import {
  assertCanonicalSubsequence,
  assertGoogleAfterPrimary,
  expectedLoginOrder,
  expectedRegisterOrder,
} from "./order";
import { DNX_AUTH_CTA, DNX_LOGIN_ORDER } from "./types";
import { listAuthBrandConfigs, getAuthBrandConfig } from "./brand";
import { listAuthUiStories } from "./catalog/stories";

function main() {
  assert.equal(DNX_LOGIN_ORDER[0], "identity");
  assert.equal(DNX_LOGIN_ORDER[9], "google");
  assert.equal(DNX_AUTH_CTA.login, "Iniciar sesión");
  assert.equal(DNX_AUTH_CTA.showPassword, "Mostrar contraseña");

  const brands = listAuthBrandConfigs();
  assert.equal(brands.length, 5);
  for (const b of brands) {
    assert.ok(b.privacyUrl);
    assert.ok(b.termsUrl);
    assert.ok(b.logo.src);
  }

  assert.equal(getAuthBrandConfig("infospot").invitationOnly, true);
  assert.equal(getAuthBrandConfig("fotoffice").googleVisualEmphasis, "emphasized");
  assert.equal(getAuthBrandConfig("clickaton").allowGoogle, true);

  // Orden login simulado canónico
  const loginObserved = [
    "identity",
    "title",
    "description",
    "email",
    "password",
    "aux-row",
    "primary-cta",
    "error",
    "divider",
    "google",
    "create-account",
    "help",
    "legal",
  ];
  const loginCheck = assertCanonicalSubsequence(loginObserved, expectedLoginOrder());
  assert.equal(loginCheck.ok, true, JSON.stringify(loginCheck));

  const googleOk = assertGoogleAfterPrimary(loginObserved);
  assert.equal(googleOk.ok, true, googleOk.detail);

  // Anti-patrón: Google arriba
  const googleFirst = assertGoogleAfterPrimary([
    "identity",
    "google",
    "divider",
    "email",
    "password",
    "primary-cta",
  ]);
  assert.equal(googleFirst.ok, false);

  // Anti-patrón: Google después de crear cuenta
  const googleLate = assertGoogleAfterPrimary([
    "primary-cta",
    "divider",
    "create-account",
    "google",
  ]);
  assert.equal(googleLate.ok, false);

  const regObserved = [
    "identity",
    "title",
    "firstName",
    "lastName",
    "email",
    "password",
    "passwordConfirm",
    "requirements",
    "consents",
    "primary-cta",
    "divider",
    "google",
    "have-account",
    "legal",
  ];
  const regCheck = assertCanonicalSubsequence(regObserved, expectedRegisterOrder());
  assert.equal(regCheck.ok, true, JSON.stringify(regCheck));

  const stories = listAuthUiStories();
  assert.ok(stories.length >= 12);
  assert.ok(stories.some((s) => s.id === "login-fotoffice"));

  console.log("auth-ui order.selfcheck PASS");
  console.log(`brands=${brands.length} stories=${stories.length}`);
}

main();
