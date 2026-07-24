/**
 * Contratos Etapa 22 — override email, tasas, boundaries editor.
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/notifications/etapa-22-contract.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatRateLabel } from "./metrics";
import { resolveNotificationEmailTo } from "./email-override";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

{
  assert.equal(formatRateLabel(2, 8), "2 de 8 — 25 %");
  assert.equal(formatRateLabel(0, 0), "—");
  assert.equal(formatRateLabel(1, 3), "1 de 3 — 33.3 %");
}

{
  const prod = resolveNotificationEmailTo({
    recipientEmail: "a@x.com",
    vercelEnv: "production",
    nodeEnv: "production",
    override: "qa@x.com",
  });
  assert.equal(prod.overridden, false);
  const preview = resolveNotificationEmailTo({
    recipientEmail: "a@x.com",
    vercelEnv: "preview",
    nodeEnv: "production",
    override: "qa@x.com",
  });
  assert.equal(preview.overridden, true);
}

{
  // Client components no deben importar el barrel @repo/db (carga Prisma.dmmf).
  const clientFiles = [
    "components/redaccion/editorial-actions-panel.tsx",
    "components/redaccion/article-form.tsx",
    "components/redaccion/article-publish-toolbar.tsx",
    "components/redaccion/event-editor-form.tsx",
    "components/public/album-commerce-cta.tsx",
    "components/editorial/article-view.tsx",
  ];
  for (const rel of clientFiles) {
    const abs = resolve(root, rel);
    assert.equal(existsSync(abs), true, rel);
    const src = readFileSync(abs, "utf8");
    assert.equal(
      /from\s+["']@repo\/db["']/.test(src),
      false,
      `${rel} importa @repo/db (debe usar /permissions o /clf-album-availability)`,
    );
  }

  const eventAdapter = readFileSync(
    resolve(root, "lib/editorial/event-adapter.ts"),
    "utf8",
  );
  assert.match(eventAdapter, /@repo\/db\/permissions/);
  assert.equal(/from\s+["']@repo\/db["']/.test(eventAdapter), false);
}

{
  const pkg = JSON.parse(
    readFileSync(resolve(root, "../../packages/db/package.json"), "utf8"),
  ) as { exports?: Record<string, string> };
  assert.ok(pkg.exports?.["./permissions"]);
  assert.ok(pkg.exports?.["./clf-album-availability"]);
}

console.log("etapa-22-contract.test.ts: OK");
