/**
 * Intenta pagar preferencia MP TEST con tarjeta oficial APRO (Checkout Pro).
 * Headed opcional: E2E_HEADLESS=0
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const CHECKOUT =
  process.env.MP_CHECKOUT_URL?.trim() ||
  readFileSync("/tmp/clickaton_10c31_checkout_url.txt", "utf8").trim();
const HEADLESS = process.env.E2E_HEADLESS !== "0";

async function main() {
  if (!CHECKOUT.includes("mercadopago.com")) throw new Error("missing_checkout_url");
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();
  const log: string[] = [];
  try {
    await page.goto(CHECKOUT, { waitUntil: "domcontentloaded", timeout: 120_000 });
    log.push(`landed:${new URL(page.url()).host}`);

    // Prefer card payment option if chooser appears
    const cardOpt = page.getByText(/tarjeta|credit|débito|debit/i).first();
    if (await cardOpt.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cardOpt.click();
      log.push("chose_card");
    }

    // Fill card — MP uses iframes often
    const frames = page.frames();
    log.push(`frames:${frames.length}`);

    async function fillInAny(selector: string, value: string, label: string) {
      for (const ctx of [page, ...page.frames()]) {
        const loc = ctx.locator(selector).first();
        if (await loc.count().catch(() => 0)) {
          try {
            await loc.fill(value, { timeout: 3000 });
            log.push(`filled:${label}`);
            return true;
          } catch {
            /* try next */
          }
        }
      }
      return false;
    }

    // Official Mastercard TEST
    await fillInAny(
      'input[name="cardNumber"], input[id*="cardNumber"], input[autocomplete="cc-number"]',
      "5031755734530604",
      "number",
    );
    await fillInAny(
      'input[name="cardExpirationMonth"], input[name="expirationDate"], input[autocomplete="cc-exp"]',
      "1130",
      "exp",
    );
    await fillInAny(
      'input[name="securityCode"], input[autocomplete="cc-csc"], input[name="cvv"]',
      "123",
      "cvv",
    );
    await fillInAny(
      'input[name="cardholderName"], input[autocomplete="cc-name"]',
      "APRO",
      "name",
    );
    await fillInAny(
      'input[name="docNumber"], input[name="identificationNumber"]',
      "12345678",
      "doc",
    );

    const payBtn = page.getByRole("button", { name: /pagar|pay|continuar|confirmar/i }).first();
    if (await payBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await payBtn.click();
      log.push("clicked_pay");
    }

    await page.waitForTimeout(12_000);
    log.push(`final_host:${new URL(page.url()).host}`);
    log.push(`final_path:${new URL(page.url()).pathname}`);
    await page.screenshot({ path: "/tmp/clickaton_10c31_mp_pay.png", fullPage: true });
    writeFileSync(
      "/tmp/clickaton_10c31_mp_pay.json",
      JSON.stringify({ ok: true, url: page.url().slice(0, 200), log }, null, 2),
    );
    console.log(JSON.stringify({ ok: true, urlHost: new URL(page.url()).host, log }, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeFileSync(
      "/tmp/clickaton_10c31_mp_pay.json",
      JSON.stringify({ ok: false, error: msg, log }, null, 2),
    );
    console.error(JSON.stringify({ ok: false, error: msg, log }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
