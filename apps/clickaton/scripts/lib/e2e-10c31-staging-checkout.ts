/**
 * E2E 10C.3.1: inscripción guest + checkout 100% en Staging (Playwright).
 * No firma tokens en local. Deja el navegador en MP para pago TEST manual si hace falta.
 *
 * Uso:
 *   CLICKATON_PUBLIC_URL=https://clickaton-staging.vercel.app \
 *   npx tsx scripts/lib/e2e-10c31-staging-checkout.ts
 */
import { chromium, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const BASE =
  (process.env.CLICKATON_PUBLIC_URL || "https://clickaton-staging.vercel.app").replace(
    /\/$/,
    "",
  );
const SLUG = process.env.CLICKATON_E2E_EDITION_SLUG || "clickaton-argentina-2026";
const PHOTO = process.env.CLICKATON_E2E_PHOTO || "/tmp/ck_e2e_profile.jpg";
const HEADLESS = process.env.E2E_HEADLESS !== "0";

function testEmail(): string {
  const suffix = randomBytes(3).toString("hex");
  return `e2e10c31.${suffix}@testuser.com`;
}

async function clickContinuar(page: Page) {
  const btn = page.getByRole("button", { name: /continuar|siguiente|confirmar inscripción/i });
  await btn.first().click();
}

async function main() {
  if (!BASE.includes("clickaton-staging")) {
    throw new Error("requires_clickaton_staging_public_url");
  }

  const email = testEmail();
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext();
  const page = await context.newPage();

  const out: Record<string, unknown> = {
    base: BASE,
    slug: SLUG,
    email,
    steps: [] as string[],
  };

  try {
    await page.goto(`${BASE}/maratones/${SLUG}/inscripcion`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    (out.steps as string[]).push("opened_inscripcion");

    // Venue step (optional)
    const venueRadio = page.locator('input[name="venue"]').first();
    if (await venueRadio.count()) {
      await page.locator('label:has(input[name="venue"])').first().click();
      await clickContinuar(page);
      (out.steps as string[]).push("venue");
    }

    // Ticket
    await page.waitForTimeout(500);
    const ticketLabel = page.locator('label:has(input[name="ticket"]:not([disabled]))').first();
    await ticketLabel.waitFor({ timeout: 30_000 });
    await ticketLabel.click();
    // Prefer first select/variant if present
    const variant = page.locator("select").first();
    if (await variant.count()) {
      const options = await variant.locator("option").all();
      if (options.length > 1) await variant.selectOption({ index: 1 });
    }
    await clickContinuar(page);
    (out.steps as string[]).push("ticket");

    // Participant — usar ids del wizard (getByLabel se cruza con Instagram/email).
    await page.locator("#firstName").fill("E2E");
    await page.locator("#lastName").fill("Staging");
    await page.locator("#email").fill(email);
    await page.locator("#instagramHandle").fill(`e2e_ck_${Date.now().toString().slice(-6)}`);
    if (await page.locator("#documentNumber").count()) {
      await page.locator("#documentNumber").fill("30111222");
    }
    if (await page.locator("#city").count()) await page.locator("#city").fill("Cordoba");
    if (await page.locator("#province").count()) {
      await page.locator("#province").fill("Cordoba");
    }
    if (await page.locator("#phone").count()) await page.locator("#phone").fill("3515551212");

    await page.setInputFiles('input[type="file"]', PHOTO);
    await page.getByText(/foto cargada/i).waitFor({ timeout: 60_000 });

    // Consents — check all checkboxes
    const checks = page.locator('input[type="checkbox"]');
    const n = await checks.count();
    for (let i = 0; i < n; i++) {
      const box = checks.nth(i);
      if (!(await box.isChecked())) await box.check({ force: true });
    }

    await clickContinuar(page);
    (out.steps as string[]).push("participant");

    // Review → submit (segundo Continuar / Confirmar)
    await page.waitForTimeout(800);
    const alertBefore = await page.locator('[role="alert"]').allTextContents();
    if (alertBefore.some((t) => t.trim())) {
      throw new Error(`participant_validation:${alertBefore.join(" | ")}`);
    }
    await page.getByRole("heading", { name: /revisá tu inscripción/i }).waitFor({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /confirmar reserva/i }).click();
    await page.waitForURL(/\/inscripcion\/resumen\//, { timeout: 90_000 });
    (out.steps as string[]).push("resumen");
    out.resumenUrl = page.url().replace(/([?&]t=)[^&]+/, "$1***");

    const regMatch = page.url().match(/resumen\/([^?]+)/);
    out.registrationIdPrefix = regMatch?.[1]?.slice(0, 8) ?? null;

    // Pay CTA
    const pay = page.getByRole("button", { name: /pagar|ir a pagar|continuar al pago|mercado/i });
    if (await pay.count()) {
      await pay.first().click();
    } else {
      // form submit button
      const submit = page.locator('form button[type="submit"]').first();
      await submit.click();
    }

    await page.waitForURL(/mercadopago\.com/, { timeout: 120_000 });
    (out.steps as string[]).push("mp_checkout");
    out.mpUrlHost = new URL(page.url()).host;
    out.checkoutUrlSanitized = page.url().replace(/([?&](access_token|token)=)[^&]+/gi, "$1***");

    writeFileSync("/tmp/clickaton_10c31_e2e_bundle.json", JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: true, ...out }, null, 2));

    // Keep open briefly for screenshot evidence
    await page.screenshot({ path: "/tmp/clickaton_10c31_mp.png", fullPage: true });
    if (process.env.E2E_KEEP_OPEN === "1") {
      console.log("E2E_KEEP_OPEN=1 — browser stays 10m for manual MP payment");
      await page.waitForTimeout(600_000);
    }
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
    try {
      await page.screenshot({ path: "/tmp/clickaton_10c31_e2e_error.png", fullPage: true });
    } catch {
      /* ignore */
    }
    writeFileSync("/tmp/clickaton_10c31_e2e_bundle.json", JSON.stringify(out, null, 2));
    console.error(JSON.stringify({ ok: false, ...out }, null, 2));
    process.exitCode = 1;
  } finally {
    if (process.env.E2E_KEEP_OPEN !== "1") await browser.close();
  }
}

main();
