/**
 * Contratos Etapa 21 (infra browser + gates).
 * pnpm --filter infospot test:etapa-21
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveQaPassword, assertQaGate } from "./qa-kit";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

{
  assert.equal(existsSync(resolve(root, "playwright.config.ts")), true);
  assert.equal(existsSync(resolve(root, "e2e/notifications-infospot.spec.ts")), true);
  assert.equal(existsSync(resolve(root, "e2e/notifications-clf.spec.ts")), true);
}

{
  const pwd = resolveQaPassword();
  assert.ok(pwd.length >= 10);
}

{
  const prev = process.env.DNX_NOTIFICATIONS_QA_ALLOW_SEED;
  delete process.env.DNX_NOTIFICATIONS_QA_ALLOW_SEED;
  assert.throws(() => assertQaGate(), /DNX_NOTIFICATIONS_QA_ALLOW_SEED/);
  if (prev !== undefined) process.env.DNX_NOTIFICATIONS_QA_ALLOW_SEED = prev;
}

console.log("etapa-21-browser.test.ts: OK");
