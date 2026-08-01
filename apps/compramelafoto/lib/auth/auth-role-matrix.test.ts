/**
 * Matriz de roles / destinations / guards (ETAPA 03).
 *
 *   ./packages/db/node_modules/.bin/tsx apps/compramelafoto/lib/auth/auth-role-matrix.test.ts
 */

import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import { getPostLoginDestination } from "./post-login-destination";

type MatrixRow = {
  role: string;
  destination: string;
  labPanel: boolean;
  photographerPanel: boolean;
  adminPanel: boolean;
};

const MATRIX: MatrixRow[] = [
  { role: "CUSTOMER", destination: "/cliente/dashboard", labPanel: false, photographerPanel: false, adminPanel: false },
  { role: "PHOTOGRAPHER", destination: "/fotografo/dashboard", labPanel: false, photographerPanel: true, adminPanel: false },
  { role: "ORGANIZER", destination: "/organizador/dashboard", labPanel: false, photographerPanel: false, adminPanel: false },
  { role: "LAB", destination: "/lab/dashboard", labPanel: true, photographerPanel: false, adminPanel: false },
  { role: "LAB_PHOTOGRAPHER", destination: "/lab/dashboard", labPanel: true, photographerPanel: true, adminPanel: false },
  { role: "ADMIN", destination: "/admin", labPanel: false, photographerPanel: false, adminPanel: true },
  { role: "SUPER_ADMIN", destination: "/admin", labPanel: false, photographerPanel: false, adminPanel: true },
  { role: "SCHOOL_ORGANIZER", destination: "/escuela", labPanel: false, photographerPanel: false, adminPanel: false },
];

/** Paridad Legacy requireAuth: LAB_PHOTOGRAPHER cruza LAB + PHOTOGRAPHER. */
function effectiveAllowed(allowed: Role[], userRole: Role): boolean {
  const effective = [...allowed];
  if (allowed.includes(Role.LAB_PHOTOGRAPHER)) {
    effective.push(Role.LAB, Role.PHOTOGRAPHER);
  }
  if (allowed.includes(Role.LAB) || allowed.includes(Role.PHOTOGRAPHER)) {
    effective.push(Role.LAB_PHOTOGRAPHER);
  }
  return effective.includes(userRole);
}

for (const row of MATRIX) {
  assert.equal(getPostLoginDestination(row.role), row.destination, row.role);
}

assert.equal(effectiveAllowed([Role.LAB], Role.LAB), true);
assert.equal(effectiveAllowed([Role.LAB], Role.LAB_PHOTOGRAPHER), true);
assert.equal(effectiveAllowed([Role.LAB], Role.CUSTOMER), false);
assert.equal(effectiveAllowed([Role.PHOTOGRAPHER], Role.LAB_PHOTOGRAPHER), true);
assert.equal(effectiveAllowed([Role.ADMIN], Role.PHOTOGRAPHER), false);
assert.equal(effectiveAllowed([Role.CUSTOMER], Role.CUSTOMER), true);

// Multirole efectivo LAB+fotógrafo: un solo primary role LAB_PHOTOGRAPHER → /lab/dashboard
assert.equal(getPostLoginDestination("LAB_PHOTOGRAPHER"), "/lab/dashboard");

// Anónimo / desconocido
assert.equal(getPostLoginDestination(null), "/");
assert.equal(getPostLoginDestination(undefined), "/");
assert.equal(getPostLoginDestination("UNKNOWN"), "/");

console.log("auth-role-matrix.test.ts: ok");
console.log(`  rows=${MATRIX.length}`);
