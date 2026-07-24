/**
 * Smoke browser Etapa 21 (storage states + rutas críticas).
 * Requiere servidores en 3004/3002 y artifacts QA.
 *
 *   DNX_NOTIFICATIONS_QA_ALLOW_SEED=1 pnpm --filter infospot notifications:browser-smoke
 */
import { chromium } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@repo/db";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifacts = resolve(root, ".qa-artifacts");

async function main() {
  const browser = await chromium.launch();
  const results: Array<Record<string, unknown>> = [];

  async function check(
    name: string,
    storage: string | null,
    url: string,
    assertFn: (body: string, status: number, finalUrl: string) => boolean,
  ) {
    const ctx = storage
      ? await browser.newContext({ storageState: storage })
      : await browser.newContext();
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const status = res?.status() ?? 0;
    const body = await page.locator("body").innerText().catch(() => "");
    const finalUrl = page.url();
    const ok = assertFn(body, status, finalUrl);
    results.push({
      name,
      status,
      ok,
      finalUrl: finalUrl.slice(0, 100),
      snippet: body.slice(0, 140).replace(/\s+/g, " "),
    });
    await ctx.close();
  }

  await check(
    "director-admin",
    resolve(artifacts, "storage-director-127.0.0.1.json"),
    "http://127.0.0.1:3004/admin/notificaciones",
    (b) => /Campañas de notificación/i.test(b),
  );
  await check(
    "editor-both-admin",
    resolve(artifacts, "storage-editor_both-127.0.0.1.json"),
    "http://127.0.0.1:3004/admin/notificaciones",
    (b) => /Campañas de notificación/i.test(b),
  );
  await check(
    "photo-inbox",
    resolve(artifacts, "storage-photo_inapp-127.0.0.1.json"),
    "http://127.0.0.1:3002/fotografo/notificaciones",
    (_b, s) => s > 0 && s < 500,
  );
  await check(
    "photo-prefs",
    resolve(artifacts, "storage-photo_inapp-127.0.0.1.json"),
    "http://127.0.0.1:3002/fotografo/configuracion/notificaciones",
    (b) => /Preferencias de notificaciones/i.test(b),
  );
  await check(
    "invalid-token",
    null,
    "http://127.0.0.1:3002/n/nt_invalid_etapa21",
    (_b, s) => s > 0 && s < 500,
  );

  const photo = await prisma.user.findFirst({
    where: { email: "qa-notif-inapp-only@dnx-qa-notifications.invalid" },
    select: { id: true },
  });
  if (photo) {
    const d = await prisma.dnxNotificationDelivery.findFirst({
      where: { userId: photo.id, channel: "IN_APP", status: "SENT" },
      select: { publicToken: true, clickedAt: true },
    });
    if (d?.publicToken && existsSync(resolve(artifacts, "storage-photo_inapp-127.0.0.1.json"))) {
      await check(
        "cta-token",
        resolve(artifacts, "storage-photo_inapp-127.0.0.1.json"),
        `http://127.0.0.1:3002/n/${d.publicToken}`,
        (_b, s) => s > 0 && s < 500,
      );
      const after = await prisma.dnxNotificationDelivery.findUnique({
        where: { publicToken: d.publicToken },
        select: { clickedAt: true, clickCount: true },
      });
      results.push({
        name: "cta-click-metrics",
        ok: Boolean(after?.clickedAt),
        clickCount: after?.clickCount ?? 0,
      });
    }
  }

  await prisma.$disconnect();
  await browser.close();

  const failed = results.filter((r) => r.ok === false);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
