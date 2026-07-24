/**
 * Contratos de UI Etapa 20 (InfoSpot no tiene Playwright en package.json).
 * Verifica rutas/acciones exportadas sin browser real.
 *
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/notifications/etapa-20-browser-contract.test.ts
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const requiredPaths = [
  "app/admin/notificaciones/page.tsx",
  "app/admin/notificaciones/[id]/page.tsx",
  "components/admin/notification-campaign-ops.tsx",
  "components/redaccion/nearby-notify-panel.tsx",
  "app/actions/notification-campaigns.ts",
  "app/actions/nearby-notify.ts",
  "app/api/cron/notifications-outbox/route.ts",
];

for (const rel of requiredPaths) {
  const abs = resolve(root, rel);
  assert.equal(existsSync(abs), true, `Falta ${rel}`);
}

// Etapa 21: Playwright focalizado en apps/infospot/e2e (notificaciones).
assert.equal(existsSync(resolve(root, "playwright.config.ts")), true);
assert.equal(existsSync(resolve(root, "e2e/notifications-infospot.spec.ts")), true);

console.log("etapa-20-browser-contract.test.ts: OK (Playwright Etapa 21 presente)");
