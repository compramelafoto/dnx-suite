/**
 * Self-check ETAPA 03 — única fuente de identidad CLF (dnx_session).
 *
 *   ./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/auth/auth-sot.selfcheck.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DNX_SESSION_COOKIE } from "@repo/auth";
import {
  CLF_AUTH_SOT,
  getAuthCookieHeaderValue,
} from "../auth";
import {
  CLF_POST_LOGIN_PATHS,
  getPostLoginDestination,
} from "./post-login-destination";

const authTs = readFileSync(path.resolve(__dirname, "../auth.ts"), "utf8");

assert.equal(CLF_AUTH_SOT.cookie, DNX_SESSION_COOKIE);
assert.equal(CLF_AUTH_SOT.cookie, "dnx_session");
assert.equal(CLF_AUTH_SOT.legacyCookie, "auth-token");
assert.equal(CLF_AUTH_SOT.dualSessionEnabled, false);
assert.equal(CLF_AUTH_SOT.legacySessionAfterCutover, "RELOGIN_REQUIRED");

// Runtime normal: no lectura de auth-token como fallback
assert.equal(
  /verifyLegacyToken|auth-token fallback|legacyToken/.test(authTs),
  false,
  "auth.ts no debe leer auth-token como fallback",
);
assert.match(authTs, /getSessionUserByRawToken/);
assert.match(authTs, /createUserSession/);
assert.match(authTs, /destroyUserSessionByRawToken/);
assert.match(authTs, /export async function getCurrentUser/);
assert.match(authTs, /export async function getCurrentIdentity/);
assert.match(authTs, /export async function getCurrentSession/);

// getAuthCookieHeaderValue solo expira Legacy (Max-Age=0), no emite payload
const expireHeader = getAuthCookieHeaderValue({ id: 1, role: "LAB" as never });
assert.match(expireHeader, /auth-token=/);
assert.match(expireHeader, /Max-Age=0/);
assert.equal(expireHeader.includes("userId"), false);

// Destinos post-login (incl. LAB de ETAPA 02)
const destinations: Array<[string, string]> = [
  ["ADMIN", "/admin"],
  ["SUPER_ADMIN", "/admin"],
  ["PHOTOGRAPHER", "/fotografo/dashboard"],
  ["CUSTOMER", "/cliente/dashboard"],
  ["ORGANIZER", "/organizador/dashboard"],
  ["LAB", "/lab/dashboard"],
  ["LAB_PHOTOGRAPHER", "/lab/dashboard"],
  ["SCHOOL_ORGANIZER", "/escuela"],
];
for (const [role, expected] of destinations) {
  assert.equal(getPostLoginDestination(role), expected, `destination ${role}`);
}
assert.equal(CLF_POST_LOGIN_PATHS.LAB, "/lab/dashboard");
assert.equal(getPostLoginDestination("LAB", "//evil"), "/lab/dashboard");

console.log("auth-sot.selfcheck.ts: ok");
console.log(`  SoT=${CLF_AUTH_SOT.cookie} dual=${CLF_AUTH_SOT.dualSessionEnabled}`);
console.log(`  cutover=${CLF_AUTH_SOT.legacySessionAfterCutover}`);
