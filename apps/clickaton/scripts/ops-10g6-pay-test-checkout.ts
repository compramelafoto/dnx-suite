/**
 * Pay Staging MP TEST Checkout Pro with official APRO card.
 * Does not touch Production. Never prints secrets.
 */
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const CHECKOUT =
  process.env.MP_CHECKOUT_URL?.trim() ||
  readFileSync("/tmp/clickaton_10g6_checkout_url.txt", "utf8").trim();
const HEADLESS = process.env.E2E_HEADLESS !== "0";

async function main() {
  if (!CHECKOUT.includes("mercadopago.com")) throw new Error("missing_checkout_url");
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage();
  const log: string[] = [];
  try {
    await page.goto(CHECKOUT, { waitUntil: "domcontentloaded", timeout: 120_000 });
    log.push(`landed:${page.url().slice(0, 120)}`);
    await page.waitForTimeout(4000);

    // Decline login if prompted — guest card path
    const guest = page.getByText(/pagar sin cuenta|continuar sin|invitado/i).first();
    if (await guest.isVisible({ timeout: 4000 }).catch(() => false)) {
      await guest.click();
      log.push("guest_path");
      await page.waitForTimeout(1500);
    }

    const cardOpt = page
      .getByRole("button", { name: /tarjeta|crédito|débito|credit|debit/i })
      .or(page.getByText(/nueva tarjeta|tarjeta de crédito|tarjeta de débito/i))
      .first();
    if (await cardOpt.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await cardOpt.click();
      log.push("chose_card");
      await page.waitForTimeout(2500);
    }

    async function fillAnywhere(selectors: string[], value: string, label: string) {
      for (const ctx of [page, ...page.frames()]) {
        for (const sel of selectors) {
          const loc = ctx.locator(sel).first();
          if ((await loc.count().catch(() => 0)) > 0) {
            try {
              await loc.fill(value, { timeout: 4000 });
              log.push(`filled:${label}`);
              return true;
            } catch {
              /* next */
            }
          }
        }
      }
      return false;
    }

    await fillAnywhere(
      [
        'input[name="cardNumber"]',
        'input[id*="cardNumber"]',
        'input[autocomplete="cc-number"]',
        'input[aria-label*="número" i]',
      ],
      "5031755734530604",
      "number",
    );
    await fillAnywhere(
      [
        'input[name="cardExpirationMonth"]',
        'input[name="expirationDate"]',
        'input[autocomplete="cc-exp"]',
        'input[aria-label*="vencimiento" i]',
      ],
      "11/30",
      "exp",
    );
    await fillAnywhere(
      [
        'input[name="securityCode"]',
        'input[name="cvv"]',
        'input[autocomplete="cc-csc"]',
        'input[aria-label*="seguridad" i]',
      ],
      "123",
      "cvv",
    );
    await fillAnywhere(
      [
        'input[name="cardholderName"]',
        'input[autocomplete="cc-name"]',
        'input[aria-label*="titular" i]',
      ],
      "APRO",
      "name",
    );
    await fillAnywhere(
      [
        'input[name="docNumber"]',
        'input[name="identificationNumber"]',
        'input[aria-label*="documento" i]',
      ],
      "12345678",
      "doc",
    );

    // email if asked
    await fillAnywhere(
      ['input[type="email"]', 'input[name="email"]'],
      "buyer.10g6.pay@testuser.com",
      "email",
    );

    const payBtn = page
      .getByRole("button", { name: /pagar|pay|continuar|confirmar/i })
      .first();
    if (await payBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await payBtn.click();
      log.push("clicked_pay");
    }

    await page.waitForTimeout(15_000);
    log.push(`final:${page.url().slice(0, 180)}`);
    await page.screenshot({ path: "/tmp/clickaton_10g6_mp_pay.png", fullPage: true });
    const out = { ok: true, url: page.url().slice(0, 220), log };
    writeFileSync("/tmp/clickaton_10g6_mp_pay.json", JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const out = { ok: false, error: msg, log, url: page.url().slice(0, 220) };
    writeFileSync("/tmp/clickaton_10g6_mp_pay.json", JSON.stringify(out, null, 2));
    await page.screenshot({ path: "/tmp/clickaton_10g6_mp_pay.png", fullPage: true }).catch(() => {});
    console.error(JSON.stringify(out, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
