/**
 * Tests: política de bootstrap admin staging (sin red).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/auth/admin-bootstrap-policy.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const routePath = join(
  process.cwd(),
  "../../apps/compramelafoto/app/api/admin/set-admin-role/route.ts",
);
const pagePath = join(process.cwd(), "../../apps/compramelafoto/app/admin/page.tsx");
const layoutPath = join(
  process.cwd(),
  "../../apps/compramelafoto/components/admin/AdminLayout.tsx",
);

const route = readFileSync(routePath, "utf8");
const page = readFileSync(pagePath, "utf8");
const layout = readFileSync(layoutPath, "utf8");

{
  assert.match(route, /ENABLE_STAGING_ADMIN_BOOTSTRAP/);
  assert.match(route, /getAuthUser/);
  assert.doesNotMatch(route, /cuart\.daniel@gmail\.com/);
  assert.match(route, /status: 404/);
}

{
  assert.doesNotMatch(page, /cuart\.daniel@gmail\.com/);
  assert.doesNotMatch(page, /Actualizar mi rol a ADMIN/);
  assert.match(page, /Error al cargar el dashboard/);
  assert.match(page, /Reintentar/);
}

{
  assert.doesNotMatch(layout, /cuart\.daniel@gmail\.com/);
}

console.log("admin-bootstrap-policy.test.ts: ok");
