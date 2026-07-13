/**
 * Tests flujo de inicio OAuth Google (sin red / sin secretos).
 * Ejecutar: pnpm --filter infospot test:google-oauth-start
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildGoogleOAuthStartHref,
  friendlyGoogleLoginError,
  resolveInfoSpotPostLoginPathLite,
  safeInfoSpotNextPath,
} from "./google-oauth-start";

const here = dirname(fileURLToPath(import.meta.url));
const loginFormSrc = readFileSync(join(here, "../app/ingresar/login-form.tsx"), "utf8");
const ingresarPageSrc = readFileSync(join(here, "../app/ingresar/page.tsx"), "utf8");
const googleRouteSrc = readFileSync(join(here, "../app/api/auth/google/route.ts"), "utf8");

// 1. Href base y con next / rememberMe
{
  assert.equal(buildGoogleOAuthStartHref(), "/api/auth/google");
  assert.equal(buildGoogleOAuthStartHref({}), "/api/auth/google");
  assert.equal(
    buildGoogleOAuthStartHref({ next: "/redaccion" }),
    "/api/auth/google?next=%2Fredaccion",
  );
  assert.equal(
    buildGoogleOAuthStartHref({ next: "/ingresar/acceso-pendiente", rememberMe: true }),
    "/api/auth/google?next=%2Fingresar%2Facceso-pendiente&rememberMe=1",
  );
  assert.equal(
    buildGoogleOAuthStartHref({ next: "https://evil.example", rememberMe: true }),
    "/api/auth/google?rememberMe=1",
  );
  assert.equal(buildGoogleOAuthStartHref({ next: "//evil.example" }), "/api/auth/google");
}

// 2. safeInfoSpotNextPath
{
  assert.equal(safeInfoSpotNextPath("/redaccion"), "/redaccion");
  assert.equal(safeInfoSpotNextPath("//evil"), "/redaccion");
  assert.equal(safeInfoSpotNextPath("https://x"), "/redaccion");
  assert.equal(safeInfoSpotNextPath(null, "/ingresar"), "/ingresar");
}

// 3. Usuario sin rol → acceso pendiente
{
  const dest = resolveInfoSpotPostLoginPathLite({
    suiteRole: "CUSTOMER",
    membershipRole: null,
    membershipStatus: null,
  });
  assert.equal(dest.hasAccess, false);
  assert.equal(dest.path, "/ingresar/acceso-pendiente");
}

// 4. Usuario con rol Director → redacción
{
  const dest = resolveInfoSpotPostLoginPathLite({
    suiteRole: "CUSTOMER",
    membershipRole: "INFOSPOT_DIRECTOR",
    membershipStatus: "ACTIVE",
  });
  assert.equal(dest.hasAccess, true);
  assert.equal(dest.path, "/redaccion");
}

// 5. Mensajes de error seguros
{
  assert.equal(friendlyGoogleLoginError(null), null);
  assert.equal(
    friendlyGoogleLoginError("Cancelaste o falló el acceso con Google."),
    "Cancelaste o falló el acceso con Google.",
  );
  assert.equal(
    friendlyGoogleLoginError("stack\n at foo client_id=secret"),
    "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
  );
  assert.equal(
    friendlyGoogleLoginError("token=abc&client_id=xyz"),
    "No pudimos iniciar sesión con Google. Volvé a intentarlo.",
  );
}

// 6. Login form: enlace real (no button-only), fuera del form password, loading copy
{
  assert.match(loginFormSrc, /href=\{googleHref\}/);
  assert.match(loginFormSrc, /buildGoogleOAuthStartHref/);
  assert.match(loginFormSrc, /Redirigiendo a Google/);
  assert.match(loginFormSrc, /Continuar con Google/);
  assert.match(loginFormSrc, /aria-disabled=\{googlePending/);
  assert.doesNotMatch(loginFormSrc, /window\.location\.assign/);
  const googleIdx = loginFormSrc.indexOf("<a");
  const formIdx = loginFormSrc.indexOf('<form action="/api/auth/login"');
  assert.ok(googleIdx > 0 && formIdx > googleIdx, "Google link must be outside password form");
}

// 7. Página sanitiza error OAuth
{
  assert.match(ingresarPageSrc, /friendlyGoogleLoginError/);
}

// 8. Ruta OAuth start presente
{
  assert.match(googleRouteSrc, /buildGoogleAuthorizationUrl/);
  assert.match(googleRouteSrc, /getGoogleOAuthCredentials/);
  assert.match(googleRouteSrc, /NextResponse\.redirect/);
}

console.log("google-oauth-start.test.ts: ok");
