/**
 * Self-check estático de paridad Panel Lab (ETAPA 02).
 * No toca DB ni red. Ejecutar:
 *   pnpm --filter compramelafoto exec tsx lib/lab/lab-parity.selfcheck.ts
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  CLF_POST_LOGIN_PATHS,
  getPostLoginDestination,
} from "../auth/post-login-destination";

const appRoot = path.resolve(__dirname, "../..");

const LAB_PAGES = [
  "app/lab/layout.tsx",
  "app/lab/dashboard/page.tsx",
  "app/lab/login/page.tsx", // alias → /login?redirect=/lab/dashboard (auth unificado ETAPA 03)
  "app/lab/registro/page.tsx",
  "app/lab/pedidos/page.tsx",
  "app/lab/pedidos/orders-table.tsx",
  "app/lab/clientes/page.tsx",
  "app/lab/albumes/page.tsx",
  "app/lab/productos/page.tsx",
  "app/lab/configuracion/page.tsx",
  "app/lab/configuracion/[section]/page.tsx",
  "app/lab/comunidad/page.tsx",
  "app/lab/soporte/page.tsx",
  "app/lab/referrals/page.tsx",
  "app/lab/catalogo/page.tsx",
  "app/lab/precios/page.tsx",
  "app/lab/negocio/page.tsx",
] as const;

const LAB_APIS = [
  "app/api/lab/status/route.ts",
  "app/api/lab/dashboard/route.ts",
  "app/api/lab/products/route.ts",
  "app/api/lab/pricing/route.ts",
  "app/api/lab/[id]/route.ts",
  "app/api/lab/by-user/[userId]/route.ts",
  "app/api/lab/clientes/route.ts",
  "app/api/lab/clientes/[email]/route.ts",
  "app/api/lab/interesados/route.ts",
  "app/api/lab/upload-logo/route.ts",
  "app/api/lab/create/route.ts",
  "app/api/lab/catalog/template/route.ts",
  "app/api/lab/catalog/export/route.ts",
  "app/api/lab/catalog/import/route.ts",
  "app/api/lab/catalog/variants/route.ts",
  "app/api/terms/accept/route.ts",
] as const;

const SUPPORTING = [
  "components/panels/LabLayoutClient.tsx",
  "components/panels/LabSidebar.tsx",
  "lib/lab-session-client.ts",
  "lib/default-lab-products.ts",
  "lib/terms/labTerms.ts",
  "lib/lab/helpers.ts",
  "app/api/print-orders/route.ts",
  "app/api/print-orders/[id]/status/route.ts",
  "app/api/print-orders/bulk-status/route.ts",
] as const;

for (const rel of [...LAB_PAGES, ...LAB_APIS, ...SUPPORTING]) {
  const abs = path.join(appRoot, rel);
  assert.equal(existsSync(abs), true, `missing: ${rel}`);
}

assert.equal(CLF_POST_LOGIN_PATHS.LAB, "/lab/dashboard");
assert.equal(CLF_POST_LOGIN_PATHS.LAB_PHOTOGRAPHER, "/lab/dashboard");
assert.equal(getPostLoginDestination("LAB"), "/lab/dashboard");
assert.equal(getPostLoginDestination("LAB_PHOTOGRAPHER"), "/lab/dashboard");
assert.equal(getPostLoginDestination("PHOTOGRAPHER"), "/fotografo/dashboard");
assert.equal(getPostLoginDestination("CUSTOMER"), "/cliente/dashboard");
// redirect explícito tiene prioridad
assert.equal(getPostLoginDestination("LAB", "/lab/pedidos"), "/lab/pedidos");
// open-redirect bloqueado
assert.equal(getPostLoginDestination("LAB", "//evil.com"), "/lab/dashboard");

console.log("lab-parity.selfcheck.ts: ok");
console.log(`  pages=${LAB_PAGES.length} apis=${LAB_APIS.length} supporting=${SUPPORTING.length}`);
