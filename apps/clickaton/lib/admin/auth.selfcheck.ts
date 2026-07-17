/**
 * Autocheck de política de acceso Clickatón admin (sin BD / sin Next).
 * Ejecutar: pnpm --filter clickaton exec tsx lib/admin/auth.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  isClickatonAdminEmail,
  listClickatonAdminEmails,
  normalizeEmail,
} from "../../config/admin/admins";
import { hasClickatonAdminAccess, sanitizeAdminReturnPath } from "./access";

assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
assert.equal(isClickatonAdminEmail("DNXfotografia@gmail.com"), true);
assert.equal(isClickatonAdminEmail("rodrigorincon40@gmail.com"), true);
assert.equal(isClickatonAdminEmail("tammytamerph@gmail.com"), true);
assert.equal(isClickatonAdminEmail("otro@example.com"), false);
assert.equal(listClickatonAdminEmails().length, 3);

assert.equal(hasClickatonAdminAccess(null), false);
assert.equal(
  hasClickatonAdminAccess({ email: "otro@example.com", globalRole: "USER" }),
  false,
);
assert.equal(
  hasClickatonAdminAccess({ email: "otro@example.com", globalRole: "SUPER_ADMIN" }),
  true,
);
assert.equal(
  hasClickatonAdminAccess({
    email: "  RodrigoRincon40@gmail.com ",
    globalRole: "USER",
  }),
  true,
);

assert.equal(sanitizeAdminReturnPath("/admin/ediciones"), "/admin/ediciones");
assert.equal(sanitizeAdminReturnPath("https://evil.example"), "/admin");
assert.equal(sanitizeAdminReturnPath("//evil"), "/admin");
assert.equal(sanitizeAdminReturnPath("/maratones"), "/admin");
assert.equal(sanitizeAdminReturnPath("/admin/login"), "/admin");

console.log("clickaton admin auth.selfcheck: ok");
