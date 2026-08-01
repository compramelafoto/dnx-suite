/**
 * Tests: destino post-login CLF.
 * Ejecutar: ./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/auth/post-login-destination.test.ts
 */

import assert from "node:assert/strict";
import {
  CLF_POST_LOGIN_PATHS,
  getPostLoginDestination,
  sanitizeInternalRedirect,
} from "./post-login-destination";

{
  assert.equal(sanitizeInternalRedirect("/admin"), "/admin");
  assert.equal(sanitizeInternalRedirect("//evil.com"), "");
  assert.equal(sanitizeInternalRedirect("https://evil.com"), "");
  assert.equal(sanitizeInternalRedirect(""), "");
  assert.equal(sanitizeInternalRedirect("/\\evil"), "");
}

{
  assert.equal(getPostLoginDestination("ADMIN"), "/admin");
  assert.equal(getPostLoginDestination("SUPER_ADMIN"), "/admin");
  assert.equal(getPostLoginDestination("PHOTOGRAPHER"), "/fotografo/dashboard");
  assert.equal(getPostLoginDestination("ORGANIZER"), "/organizador/dashboard");
  assert.equal(getPostLoginDestination("CUSTOMER"), "/cliente/dashboard");
  assert.equal(getPostLoginDestination("SCHOOL_ORGANIZER"), "/escuela");
  assert.equal(getPostLoginDestination("LAB"), "/lab/dashboard");
  assert.equal(getPostLoginDestination("LAB_PHOTOGRAPHER"), "/lab/dashboard");
  assert.equal(getPostLoginDestination("WORKSPACE_ADMIN"), "/");
  assert.equal(getPostLoginDestination("STAFF"), "/");
  assert.equal(getPostLoginDestination("UNKNOWN_ROLE"), "/");
}

{
  assert.equal(getPostLoginDestination("ADMIN", "/admin/blog"), "/admin/blog");
  assert.equal(getPostLoginDestination("PHOTOGRAPHER", "//evil"), "/fotografo/dashboard");
  assert.equal(getPostLoginDestination("LAB", "/lab/pedidos"), "/lab/pedidos");
  assert.equal(CLF_POST_LOGIN_PATHS.ADMIN, "/admin");
  assert.equal(CLF_POST_LOGIN_PATHS.LAB, "/lab/dashboard");
}

console.log("post-login-destination.test.ts: ok");
