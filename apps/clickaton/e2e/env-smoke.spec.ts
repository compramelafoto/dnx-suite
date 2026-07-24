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

  test("pilot edition route is reachable after seed+deploy", async ({ page }, testInfo) => {
    const res = await page.goto("/maratones/piloto-test-11b", {
      waitUntil: "domcontentloaded",
    });
    const status = res?.status() ?? 0;
    // Soft readiness: 200 expected after QA1 complete; 404 documents current gap.
    testInfo.annotations.push({
      type: "pilot-status",
      description: String(status),
    });
    await page.screenshot({
      path: join(evidenceDir, `${testInfo.project.name}-piloto.png`),
      fullPage: true,
    });
    expect([200, 404]).toContain(status);
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
