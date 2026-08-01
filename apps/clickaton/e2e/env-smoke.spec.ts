import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * QA1 environment smoke only — not the full funnel E2E (QA2).
 */
const evidenceDir = join(
  process.cwd(),
  "../../.local/qa1/screenshots",
);

test.beforeAll(() => {
  mkdirSync(evidenceDir, { recursive: true });
});

test.describe("Clickatón staging readiness smoke", () => {
  test("home responds and is noindex", async ({ page }, testInfo) => {
    const res = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(res?.ok() || res?.status() === 200).toBeTruthy();
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots ?? "").toMatch(/noindex/i);
    await page.screenshot({
      path: join(evidenceDir, `${testInfo.project.name}-home.png`),
      fullPage: true,
    });
  });

  test("published edition detail responds after schema recovery", async ({ page }, testInfo) => {
    const listRes = await page.goto("/maratones", { waitUntil: "domcontentloaded" });
    expect(listRes?.status()).toBe(200);

    const res = await page.goto("/maratones/clickaton-argentina-2026", {
      waitUntil: "domcontentloaded",
    });
    const status = res?.status() ?? 0;
    testInfo.annotations.push({
      type: "edition-status",
      description: String(status),
    });
    await page.screenshot({
      path: join(evidenceDir, `${testInfo.project.name}-argentina-2026.png`),
      fullPage: true,
    });
    expect(status).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Argentina|Clickatón/i);
  });

  test("legal terms page responds", async ({ page }) => {
    const res = await page.goto("/legal/terminos", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status()).toBe(200);
  });

  test("mi-cuenta responds (login redirect or page)", async ({ page }) => {
    const res = await page.goto("/mi-cuenta", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeTruthy();
    expect([200, 302, 307, 308].includes(res!.status()) || res!.ok()).toBeTruthy();
  });
});
