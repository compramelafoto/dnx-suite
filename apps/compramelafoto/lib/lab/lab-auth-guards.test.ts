/**
 * Guards de rol LAB (paridad Legacy requireAuth patterns).
 * Ejecutar: pnpm --filter compramelafoto exec tsx lib/lab/lab-auth-guards.test.ts
 */

import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import { getPostLoginDestination } from "../auth/post-login-destination";

/** Roles que Legacy permite en endpoints LAB panel. */
const LAB_PANEL_ROLES: Role[] = [Role.LAB, Role.LAB_PHOTOGRAPHER];

function isLabPanelRole(role: string | null | undefined): boolean {
  return role === Role.LAB || role === Role.LAB_PHOTOGRAPHER;
}

function denyNonLabAccess(role: string | null | undefined): "allow" | "deny" {
  if (!role) return "deny";
  return isLabPanelRole(role) ? "allow" : "deny";
}

{
  assert.equal(denyNonLabAccess(null), "deny");
  assert.equal(denyNonLabAccess(Role.CUSTOMER), "deny");
  assert.equal(denyNonLabAccess(Role.PHOTOGRAPHER), "deny");
  assert.equal(denyNonLabAccess(Role.ADMIN), "deny");
  assert.equal(denyNonLabAccess(Role.ORGANIZER), "deny");
  assert.equal(denyNonLabAccess(Role.LAB), "allow");
  assert.equal(denyNonLabAccess(Role.LAB_PHOTOGRAPHER), "allow");
}

{
  for (const role of LAB_PANEL_ROLES) {
    assert.equal(getPostLoginDestination(role).startsWith("/lab/"), true);
  }
  assert.equal(getPostLoginDestination(Role.PHOTOGRAPHER).startsWith("/lab/"), false);
}

console.log("lab-auth-guards.test.ts: ok");
