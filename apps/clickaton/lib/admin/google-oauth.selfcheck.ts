/**
 * Autocheck Google OAuth admin Clickatón (sin red / sin secretos / sin BD).
 * Ejecutar: pnpm --filter clickaton selfcheck:admin-google-oauth
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoogleAuthorizationUrl,
  createGoogleOAuthTransit,
  parseAndVerifyGoogleOAuthTransit,
  resolveGoogleRedirectUri,
} from "@repo/auth";
import {
  CLICKATON_GOOGLE_OAUTH_APP,
  buildGoogleOAuthStartHref,
  friendlyGoogleLoginError,
  resolveClickatonPostGoogleLoginPath,
  safeClickatonAdminNextPath,
} from "./google-oauth";

const here = dirname(fileURLToPath(import.meta.url));
const loginPageSrc = readFileSync(join(here, "../../app/admin/login/page.tsx"), "utf8");
const googleButtonSrc = readFileSync(
  join(here, "../../app/admin/login/GoogleLoginButton.tsx"),
  "utf8",
);
const googleRouteSrc = readFileSync(
  join(here, "../../app/api/auth/google/route.ts"),
  "utf8",
);
const callbackRouteSrc = readFileSync(
  join(here, "../../app/api/auth/google/callback/route.ts"),
  "utf8",
);

// 1. App id + start href
{
  assert.equal(CLICKATON_GOOGLE_OAUTH_APP, "clickaton");
  assert.equal(buildGoogleOAuthStartHref(), "/api/auth/google");
  assert.equal(
    buildGoogleOAuthStartHref({ next: "/admin/ediciones" }),
    "/api/auth/google?next=%2Fadmin%2Fediciones",
  );
  assert.equal(
    buildGoogleOAuthStartHref({ next: "https://evil.example" }),
    "/api/auth/google",
  );
  assert.equal(buildGoogleOAuthStartHref({ next: "//evil.example" }), "/api/auth/google");
  assert.equal(buildGoogleOAuthStartHref({ next: "/maratones" }), "/api/auth/google");
}

// 2. safe next
{
  assert.equal(safeClickatonAdminNextPath("/admin/sedes"), "/admin/sedes");
  assert.equal(safeClickatonAdminNextPath("/admin/sponsors"), "/admin/sponsors");
  assert.equal(safeClickatonAdminNextPath("/admin/configuracion"), "/admin/configuracion");
  assert.equal(safeClickatonAdminNextPath("/admin/integraciones"), "/admin/integraciones");
  assert.equal(safeClickatonAdminNextPath("/admin/inscripciones"), "/admin/inscripciones");
  assert.equal(safeClickatonAdminNextPath("https://evil"), undefined);
  assert.equal(safeClickatonAdminNextPath("//evil"), undefined);
  assert.equal(safeClickatonAdminNextPath("/otra-aplicacion"), undefined);
  assert.equal(safeClickatonAdminNextPath("javascript:alert(1)"), undefined);
}

// 3. Authorization after Google auth (auth ≠ admin)
{
  const daniel = resolveClickatonPostGoogleLoginPath({
    email: "dnxfotografia@gmail.com",
    globalRole: "USER",
    next: "/admin/ediciones",
  });
  assert.equal(daniel.authorized, true);
  assert.equal(daniel.path, "/admin/ediciones");

  const rodrigo = resolveClickatonPostGoogleLoginPath({
    email: "  RodrigoRincon40@gmail.com ",
    globalRole: "USER",
    next: "/admin",
  });
  assert.equal(rodrigo.authorized, true);
  assert.equal(rodrigo.path, "/admin");

  const tammy = resolveClickatonPostGoogleLoginPath({
    email: "TammyTamerph@gmail.com",
    globalRole: "USER",
  });
  assert.equal(tammy.authorized, true);
  assert.equal(tammy.path, "/admin");

  const stranger = resolveClickatonPostGoogleLoginPath({
    email: "intruso@example.com",
    globalRole: "USER",
    next: "/admin/ediciones",
  });
  assert.equal(stranger.authorized, false);
  assert.equal(stranger.path, "/admin/acceso-denegado");
}

// 4. Transit state / CSRF cookie
{
  const transit = createGoogleOAuthTransit({
    app: CLICKATON_GOOGLE_OAUTH_APP,
    next: "/admin/ediciones",
  });
  const ok = parseAndVerifyGoogleOAuthTransit({
    state: transit.state,
    cookieValue: transit.cookieValue,
    expectedApp: CLICKATON_GOOGLE_OAUTH_APP,
  });
  assert.ok(ok);
  assert.equal(ok?.app, "clickaton");
  assert.equal(ok?.next, "/admin/ediciones");

  assert.equal(
    parseAndVerifyGoogleOAuthTransit({
      state: transit.state,
      cookieValue: "wrong-nonce",
      expectedApp: CLICKATON_GOOGLE_OAUTH_APP,
    }),
    null,
  );
  assert.equal(
    parseAndVerifyGoogleOAuthTransit({
      state: transit.state,
      cookieValue: transit.cookieValue,
      expectedApp: "infospot",
    }),
    null,
  );
}

// 5. Authorization URL shape (scopes mínimos + callback)
{
  const redirectUri = resolveGoogleRedirectUri("http://localhost:3005");
  assert.equal(redirectUri, "http://localhost:3005/api/auth/google/callback");

  const authUrl = buildGoogleAuthorizationUrl({
    clientId: "test-client-id.apps.googleusercontent.com",
    redirectUri,
    state: "test-state",
  });
  const parsed = new URL(authUrl);
  assert.equal(parsed.origin, "https://accounts.google.com");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(parsed.searchParams.get("scope"), "openid email profile");
  assert.equal(parsed.searchParams.get("state"), "test-state");
  assert.ok(!parsed.searchParams.get("client_secret"));
}

// 6. Friendly errors (no secretos)
{
  assert.equal(friendlyGoogleLoginError(null), null);
  assert.equal(
    friendlyGoogleLoginError("Cancelaste el acceso con Google."),
    "Cancelaste el acceso con Google.",
  );
  assert.equal(
    friendlyGoogleLoginError("token=abc&client_id=xyz"),
    "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
  );
}

// 7. UI: Google + email/contraseña (ambos llevan al panel si hay autorización)
{
  assert.match(loginPageSrc, /GoogleLoginButton/);
  assert.match(loginPageSrc, /LoginForm/);
  assert.match(loginPageSrc, /Acceso al panel de Clickatón/);
  assert.match(loginPageSrc, /friendlyGoogleLoginError/);
  assert.match(loginPageSrc, /o email/);
  assert.match(googleButtonSrc, /Continuar con Google/);
  assert.match(googleButtonSrc, /buildGoogleOAuthStartHref/);
  assert.match(googleButtonSrc, /href=\{googleHref\}/);
  assert.match(googleButtonSrc, /Redirigiendo a Google/);
  const loginFormSrc = readFileSync(
    join(here, "../../app/admin/login/LoginForm.tsx"),
    "utf8",
  );
  assert.match(loginFormSrc, /type="password"/);
  assert.match(loginFormSrc, /loginAdminAction/);
}

// 8. Rutas usan helpers compartidos @repo/auth
{
  assert.match(googleRouteSrc, /buildGoogleAuthorizationUrl/);
  assert.match(googleRouteSrc, /createGoogleOAuthTransit/);
  assert.match(googleRouteSrc, /CLICKATON_GOOGLE_OAUTH_APP/);
  assert.match(callbackRouteSrc, /parseAndVerifyGoogleOAuthTransit/);
  assert.match(callbackRouteSrc, /resolveOrLinkGoogleUser/);
  assert.match(callbackRouteSrc, /fetchGoogleUserInfo/);
  assert.match(callbackRouteSrc, /attachClickatonSessionCookieToResponse/);
  assert.match(callbackRouteSrc, /resolveClickatonPostGoogleLoginPath/);
  assert.match(callbackRouteSrc, /emailVerifiedAt/);
  assert.doesNotMatch(callbackRouteSrc, /NEXT_PUBLIC_GOOGLE_CLIENT_SECRET/);
}

console.log("clickaton admin google-oauth.selfcheck: ok");
