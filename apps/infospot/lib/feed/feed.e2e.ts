/**
 * E2E del feed de Home (Playwright local).
 *
 * Requisitos:
 *   INFOSPOT_QA_BASE_URL=http://localhost:3004
 *   PLAYWRIGHT_MODULE=ruta opcional al package @playwright/test
 *
 * Ejecutar:
 *   pnpm --filter infospot test:feed:e2e
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.env.INFOSPOT_QA_BASE_URL?.replace(/\/$/, "");

if (!baseUrl) {
  console.log("feed e2e: INFOSPOT_QA_BASE_URL no definido — omitido");
  process.exit(0);
}

function loadChromium() {
  const require = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    "@playwright/test",
    "playwright",
    // pnpm nested path (monorepo)
    join(
      process.cwd(),
      "node_modules/.pnpm/@playwright+test@1.51.1/node_modules/@playwright/test",
    ),
    join(
      process.cwd(),
      "../../node_modules/.pnpm/@playwright+test@1.51.1/node_modules/@playwright/test",
    ),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      if (candidate.startsWith("/") && !existsSync(candidate)) continue;
      const mod = require(candidate);
      if (mod?.chromium?.launch) return mod.chromium as {
        launch: (opts?: { headless?: boolean }) => Promise<any>;
      };
    } catch {
      // try next
    }
  }
  throw new Error("Playwright chromium no disponible");
}

async function main() {
  let chromium: { launch: (opts?: { headless?: boolean }) => Promise<any> };
  try {
    chromium = loadChromium();
  } catch (err) {
    console.log(
      `feed e2e: no se pudo cargar Playwright — omitido (${err instanceof Error ? err.message : err})`,
    );
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const evidence: string[] = [];

  // A. Sin permisos → feed general
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ timeout: 20000 });
    const text = await page.locator("#novedades").first().textContent();
    assert.ok(text?.includes("Novedades"));
    assert.ok(text?.includes("Las últimas novedades") || text?.includes("cerca tuyo"));
    evidence.push("A_general_ok");
    await page.close();
    await context.close();
  }

  // B. GPS aceptado (Rosario simulado)
  {
    const context = await browser.newContext({
      geolocation: { latitude: -32.9468, longitude: -60.6393 },
      permissions: ["geolocation"],
    });
    await context.grantPermissions(["geolocation"], { origin: baseUrl });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ state: "visible", timeout: 30000 });
    await page.evaluate(() => {
      window.localStorage.removeItem("infospot.location.preference.v1");
      window.localStorage.removeItem("infospot.location.permissionPrompt.v1");
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("heading", { name: /Novedades/i }).first().waitFor({ timeout: 15000 });
    // Esperar hidratación del prompt / controles
    await page.waitForTimeout(800);

    const nearBtn = page
      .locator("#novedades")
      .getByRole("button", {
        name: /Ver contenido cerca mío|Cerca mío/i,
      })
      .first();
    await nearBtn.waitFor({ state: "visible", timeout: 15000 });
    await nearBtn.click({ force: true });
    await page.waitForTimeout(2000);

    const pref = await page.evaluate(() =>
      window.localStorage.getItem("infospot.location.preference.v1"),
    );
    assert.ok(pref);
    const parsed = JSON.parse(pref!) as { mode: string; latitude?: number };
    assert.equal(parsed.mode, "gps");
    assert.ok(typeof parsed.latitude === "number");

    const live = await page.locator("#novedades").first().textContent();
    assert.ok(
      live?.includes("cerca de tu ubicación") ||
        live?.includes("Cerca mío") ||
        live?.includes("cerca tuyo"),
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ timeout: 20000 });
    const pref2 = await page.evaluate(() =>
      window.localStorage.getItem("infospot.location.preference.v1"),
    );
    assert.ok(pref2);
    assert.equal(JSON.parse(pref2!).mode, "gps");
    evidence.push("B_gps_granted_ok");
    await page.close();
    await context.close();
  }

  // C. GPS rechazado → ciudad manual
  {
    const context = await browser.newContext();
    await context.clearPermissions();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ timeout: 20000 });
    await page.evaluate(() => {
      window.localStorage.removeItem("infospot.location.preference.v1");
      window.localStorage.removeItem("infospot.location.permissionPrompt.v1");
      // Forzar geolocation denial
      // @ts-expect-error override
      navigator.geolocation.getCurrentPosition = (
        _ok: unknown,
        err: (e: GeolocationPositionError) => void,
      ) => {
        err({
          code: 1,
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
          message: "denied",
        } as GeolocationPositionError);
      };
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ timeout: 20000 });

    // CTA cerca mío → denied path
    const denyBtn = page
      .locator("#novedades")
      .getByRole("button", { name: /Cerca mío|Ver contenido cerca mío/i })
      .first();
    await denyBtn.waitFor({ state: "visible", timeout: 15000 });
    await denyBtn.click({ force: true });
    await page.waitForTimeout(1000);
    const afterDeny = await page.locator("#novedades").first().textContent();
    assert.ok(
      afterDeny?.includes("ubicación") ||
        afterDeny?.includes("ciudad") ||
        afterDeny?.includes("Elegí"),
    );
    evidence.push("C_gps_denied_ok");

    // D. Manual Rosario (tras deny el picker puede quedar abierto; no togglear cerrado)
    const rosario = page.locator("#novedades").getByRole("button", { name: /^Rosario$/i });
    if ((await rosario.count()) === 0) {
      await page.locator("#novedades").getByRole("button", { name: /Elegir ciudad/i }).click();
    }
    await rosario.first().waitFor({ state: "visible", timeout: 10000 });
    await rosario.first().click();
    await page.waitForTimeout(1200);
    const pref = await page.evaluate(() =>
      window.localStorage.getItem("infospot.location.preference.v1"),
    );
    assert.ok(pref);
    assert.equal(JSON.parse(pref!).mode, "manual");
    const manualText = await page.locator("#novedades").first().textContent();
    assert.ok(
      manualText?.includes("ciudad elegida") ||
        manualText?.includes("Rosario") ||
        manualText?.includes("manual") ||
        manualText?.includes("cerca tuyo"),
    );
    evidence.push("D_manual_ok");

    // E. Todo el país
    await page.getByRole("button", { name: /Todo el país/i }).click();
    await page.waitForTimeout(800);
    const national = await page.evaluate(() =>
      window.localStorage.getItem("infospot.location.preference.v1"),
    );
    assert.ok(national);
    assert.equal(JSON.parse(national!).mode, "national");
    evidence.push("E_national_ok");

    await page.close();
    await context.close();
  }

  // F. geolocation unavailable
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript(() => {
      // @ts-expect-error delete
      delete navigator.geolocation;
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#novedades").first().waitFor({ timeout: 20000 });
    await page
      .locator("#novedades")
      .getByRole("button", { name: /^Cerca mío$/i })
      .first()
      .click();
    await page.waitForTimeout(500);
    const text = await page.locator("#novedades").first().textContent();
    assert.ok(text?.includes("Novedades"));
    assert.ok(
      text?.includes("ubicación") ||
        text?.includes("ciudad") ||
        text?.includes("Elegí"),
    );
    evidence.push("F_unavailable_ok");
    await page.close();
    await context.close();
  }

  await browser.close();
  console.log("feed e2e: ok");
  console.log(JSON.stringify({ evidence }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
