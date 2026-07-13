/**
 * Tests: listado público de labs (sin DB).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/public-labs.test.ts
 */

import assert from "node:assert/strict";
import { buildPublicLabsWhere, PUBLIC_LAB_SELECT } from "./public-labs";

{
  const where = buildPublicLabsWhere(null);
  assert.equal(where.isActive, true);
  assert.equal(where.isSuspended, false);
  assert.equal(where.OR, undefined);
}

{
  const where = buildPublicLabsWhere("  Rosario  ");
  assert.ok(where.OR);
  assert.equal(where.OR!.length, 6);
  assert.deepEqual(where.OR![0], { name: { contains: "Rosario", mode: "insensitive" } });
}

{
  const keys = Object.keys(PUBLIC_LAB_SELECT);
  assert.ok(!keys.includes("mpAccessToken"));
  assert.ok(!keys.includes("mpRefreshToken"));
  assert.ok(!keys.includes("internalNotes"));
  assert.ok(keys.includes("id"));
  assert.ok(keys.includes("name"));
  assert.ok(keys.includes("city"));
}

console.log("public-labs.test.ts: ok");
