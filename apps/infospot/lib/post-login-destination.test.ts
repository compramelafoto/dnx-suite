/**
 * Tests destino post-login + perfiles públicos (sin DB).
 * pnpm --filter infospot test:post-login-destination
 */

import assert from "node:assert/strict";
import {
  isEditorialIntentPath,
  resolveInfoSpotPostLoginDestination,
} from "./post-login-destination";
import { safeInfoSpotNextPath } from "./google-oauth-start";

{
  assert.equal(isEditorialIntentPath("/redaccion"), true);
  assert.equal(isEditorialIntentPath("/redaccion/nueva"), true);
  assert.equal(isEditorialIntentPath("/admin"), true);
  assert.equal(isEditorialIntentPath("/"), false);
  assert.equal(isEditorialIntentPath("//evil"), false);
}

{
  const denied = resolveInfoSpotPostLoginDestination({
    suiteRole: "CUSTOMER",
    membershipRole: null,
    membershipStatus: null,
    next: "/redaccion",
    hasEditorialAccess: false,
    onboardingCompleted: true,
    hasActivePublicProfile: true,
  });
  assert.equal(denied.path, "/ingresar/acceso-pendiente");
  assert.equal(denied.reason, "editorial_denied");
}

{
  const onboarding = resolveInfoSpotPostLoginDestination({
    suiteRole: "CUSTOMER",
    membershipRole: null,
    membershipStatus: null,
    next: "/",
    hasEditorialAccess: false,
    onboardingCompleted: false,
    hasActivePublicProfile: false,
  });
  assert.equal(onboarding.path, "/completar-perfil");
  assert.equal(onboarding.reason, "onboarding");
}

{
  const home = resolveInfoSpotPostLoginDestination({
    suiteRole: "CUSTOMER",
    membershipRole: null,
    membershipStatus: null,
    next: "/",
    hasEditorialAccess: false,
    onboardingCompleted: true,
    hasActivePublicProfile: true,
  });
  assert.equal(home.path, "/");
  assert.equal(home.reason, "home");
}

{
  const editor = resolveInfoSpotPostLoginDestination({
    suiteRole: "CUSTOMER",
    membershipRole: "INFOSPOT_REDACTOR",
    membershipStatus: "ACTIVE",
    next: "/redaccion",
    hasEditorialAccess: true,
    onboardingCompleted: false,
    hasActivePublicProfile: false,
  });
  assert.equal(editor.path, "/redaccion");
  assert.equal(editor.hasEditorialAccess, true);
}

{
  assert.equal(safeInfoSpotNextPath("https://evil.com"), "/redaccion");
  assert.equal(safeInfoSpotNextPath("/eventos", "/"), "/eventos");
}

console.log("post-login-destination.test.ts: ok");
