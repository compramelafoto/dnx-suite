/**
 * Autocheck login unificado + return paths + post-login (sin BD / sin red).
 * Ejecutar: pnpm --filter clickaton selfcheck:auth
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthTransit,
  parseAndVerifyGoogleOAuthTransit,
} from "@repo/auth";
import {
  isClickatonAdminEmail,
  listClickatonAdminEmails,
  normalizeEmail,
} from "../../config/admin/admins";
import { hasClickatonAdminAccess } from "../admin/access";
import {
  CLICKATON_GOOGLE_OAUTH_APP,
  buildGoogleOAuthStartHref,
  resolveClickatonPostGoogleLoginPath,
  safeClickatonNextPath,
} from "./google-oauth";
import { resolveClickatonPostLoginPath } from "./post-login";
import {
  CLICKATON_ACCOUNT_PATH,
  sanitizeAdminReturnPath,
  sanitizeClickatonReturnPath,
} from "./return-path";
import { cookieOptionsForRequest } from "./session-cookie";

const here = dirname(fileURLToPath(import.meta.url));
const loginPageSrc = readFileSync(join(here, "../../app/(public)/login/page.tsx"), "utf8");
const adminLoginSrc = readFileSync(join(here, "../../app/admin/login/page.tsx"), "utf8");
const headerSrc = readFileSync(join(here, "../../components/layout/SiteHeader.tsx"), "utf8");
const googleRouteSrc = readFileSync(
  join(here, "../../app/api/auth/google/route.ts"),
  "utf8",
);
const callbackSrc = readFileSync(
  join(here, "../../app/api/auth/google/callback/route.ts"),
  "utf8",
);

assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
assert.equal(isClickatonAdminEmail("DNXfotografia@gmail.com"), true);
assert.equal(listClickatonAdminEmails().length, 3);
assert.equal(
  hasClickatonAdminAccess({ email: "user@example.com", globalRole: "USER" }),
  false,
);

assert.equal(sanitizeClickatonReturnPath(null), CLICKATON_ACCOUNT_PATH);
assert.equal(sanitizeClickatonReturnPath("/maratones"), "/maratones");
assert.equal(sanitizeClickatonReturnPath("/mi-cuenta"), "/mi-cuenta");
assert.equal(sanitizeClickatonReturnPath("/admin/ediciones"), "/admin/ediciones");
assert.equal(sanitizeClickatonReturnPath("https://evil.example"), CLICKATON_ACCOUNT_PATH);
assert.equal(sanitizeClickatonReturnPath("//evil"), CLICKATON_ACCOUNT_PATH);
assert.equal(sanitizeClickatonReturnPath("/login"), CLICKATON_ACCOUNT_PATH);
assert.equal(sanitizeAdminReturnPath("/admin/sedes"), "/admin/sedes");
assert.equal(sanitizeAdminReturnPath("/maratones"), "/admin");

assert.equal(safeClickatonNextPath("/admin"), "/admin");
assert.equal(safeClickatonNextPath("/mi-cuenta"), "/mi-cuenta");
assert.equal(safeClickatonNextPath("https://evil"), undefined);

{
  const normal = resolveClickatonPostLoginPath({
    email: "user@example.com",
    globalRole: "USER",
  });
  assert.equal(normal.path, CLICKATON_ACCOUNT_PATH);

  const normalAdminAttempt = resolveClickatonPostLoginPath({
    email: "user@example.com",
    globalRole: "USER",
    next: "/admin/ediciones",
  });
  assert.equal(normalAdminAttempt.path, "/admin/acceso-denegado");
  assert.equal(normalAdminAttempt.adminAuthorized, false);

  const admin = resolveClickatonPostLoginPath({
    email: "dnxfotografia@gmail.com",
    globalRole: "USER",
    next: "/admin/ediciones",
  });
  assert.equal(admin.path, "/admin/ediciones");
  assert.equal(admin.adminAuthorized, true);

  const adminDefault = resolveClickatonPostGoogleLoginPath({
    email: "tammyytamer@gmail.com",
    globalRole: "USER",
  });
  assert.equal(adminDefault.path, CLICKATON_ACCOUNT_PATH);
}

assert.equal(cookieOptionsForRequest("http://localhost:3005").secure, false);
assert.equal(
  cookieOptionsForRequest("https://maratonfotografica.com", { oauthTransit: true }).secure,
  true,
);
assert.equal(
  cookieOptionsForRequest("https://maratonfotografica.com", { oauthTransit: true }).domain,
  undefined,
);

assert.equal(buildGoogleOAuthStartHref(), "/api/auth/google");
assert.equal(
  buildGoogleOAuthStartHref({ next: "/admin" }),
  "/api/auth/google?next=%2Fadmin",
);
assert.equal(buildGoogleOAuthStartHref({ next: "https://evil" }), "/api/auth/google");

{
  const transit = createGoogleOAuthTransit({
    app: CLICKATON_GOOGLE_OAUTH_APP,
    next: "/mi-cuenta",
  });
  const ok = parseAndVerifyGoogleOAuthTransit({
    state: transit.state,
    cookieValue: transit.cookieValue,
    expectedApp: CLICKATON_GOOGLE_OAUTH_APP,
  });
  assert.equal(ok?.next, "/mi-cuenta");
  assert.equal(
    parseAndVerifyGoogleOAuthTransit({
      state: transit.state,
      cookieValue: "bad",
      expectedApp: CLICKATON_GOOGLE_OAUTH_APP,
    }),
    null,
  );
}

{
  const authUrl = buildGoogleAuthorizationUrl({
    clientId: "test.apps.googleusercontent.com",
    redirectUri: "http://localhost:3005/api/auth/google/callback",
    state: "x",
  });
  assert.match(authUrl, /accounts\.google\.com/);
  assert.match(authUrl, /openid/);
}

assert.match(loginPageSrc, /Ingresá a Clickatón/);
assert.match(loginPageSrc, /GoogleLoginButton/);
assert.match(loginPageSrc, /LoginForm/);
assert.match(adminLoginSrc, /CLICKATON_LOGIN_PATH/);
assert.match(adminLoginSrc, /redirect/);
assert.doesNotMatch(adminLoginSrc, /Continuar con Google/);
assert.match(headerSrc, /Iniciar sesión/);
assert.match(headerSrc, /AccountMenu/);
assert.match(googleRouteSrc, /redirectUri = `\$\{origin\}\/api\/auth\/google\/callback`/);
assert.match(callbackSrc, /CLICKATON_LOGIN_PATH/);
assert.match(callbackSrc, /cookieOptionsForRequest/);

console.log("clickaton auth.selfcheck: ok");
