#!/usr/bin/env node
/**
 * Mint a one-time Mercado Pago TEST card token via public API.
 *
 * Card data MUST come from env (never committed). Writes only the token
 * to .local/ (gitignored). Never prints PAN/CVV/token.
 *
 * Usage:
 *   MERCADOPAGO_TEST_CARD_NUMBER=… \
 *   MERCADOPAGO_TEST_CARD_EXP_MONTH=11 \
 *   MERCADOPAGO_TEST_CARD_EXP_YEAR=2030 \
 *   MERCADOPAGO_TEST_CARD_SECURITY_CODE=… \
 *   MERCADOPAGO_TEST_CARDHOLDER_NAME=APRO \
 *   pnpm --filter @repo/payments exec tsx src/cli/imp05-mint-test-card-token.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSandboxEnvFromProcess } from "../sandbox/preflight.js";
import { MP_API_BASE_URL } from "../providers/mercado-pago/index.js";

async function main() {
  const env = loadSandboxEnvFromProcess();
  const publicKey = env.publicKey?.trim();
  if (!publicKey) {
    console.log(JSON.stringify({ ok: false, error: "PUBLIC_KEY_MISSING" }));
    process.exitCode = 1;
    return;
  }
  if (publicKey.startsWith("APP_USR-") === false && publicKey.startsWith("TEST-") === false) {
    console.log(JSON.stringify({ ok: false, error: "PUBLIC_KEY_NOT_SANDBOX_LIKE" }));
    process.exitCode = 1;
    return;
  }

  const cardNumber = process.env.MERCADOPAGO_TEST_CARD_NUMBER?.replace(/\s+/g, "") ?? "";
  const expMonth = process.env.MERCADOPAGO_TEST_CARD_EXP_MONTH?.trim() ?? "";
  const expYear = process.env.MERCADOPAGO_TEST_CARD_EXP_YEAR?.trim() ?? "";
  const securityCode = process.env.MERCADOPAGO_TEST_CARD_SECURITY_CODE?.trim() ?? "";
  const cardholderName = process.env.MERCADOPAGO_TEST_CARDHOLDER_NAME?.trim() ?? "APRO";
  const paymentMethodId =
    process.env.MERCADOPAGO_TEST_PAYMENT_METHOD_ID?.trim() ||
    (cardNumber.startsWith("5031") ? "master" : "visa");

  if (!cardNumber || !expMonth || !expYear || !securityCode) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "CARD_ENV_MISSING",
        hint: "Set MERCADOPAGO_TEST_CARD_* from official Mercado Pago TEST cards only. Do not commit values.",
      }),
    );
    process.exitCode = 1;
    return;
  }

  const url = new URL(`${MP_API_BASE_URL}/v1/card_tokens`);
  url.searchParams.set("public_key", publicKey);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: cardNumber,
      expiration_month: Number(expMonth),
      expiration_year: Number(expYear),
      security_code: securityCode,
      cardholder: {
        name: cardholderName,
        identification: {
          type: "DNI",
          number: process.env.MERCADOPAGO_TEST_CARDHOLDER_DOC?.trim() || "12345678",
        },
      },
    }),
  });

  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = null;
  }

  const token =
    typeof parsed?.id === "string"
      ? parsed.id
      : typeof parsed?.card_token_id === "string"
        ? parsed.card_token_id
        : "";

  if (!res.ok || !token) {
    console.log(
      JSON.stringify({
        ok: false,
        httpStatus: res.status,
        error:
          typeof parsed?.message === "string"
            ? parsed.message.slice(0, 120)
            : typeof parsed?.error === "string"
              ? parsed.error
              : "TOKEN_MINT_FAILED",
        causeCodes: Array.isArray(parsed?.cause)
          ? (parsed.cause as Array<{ code?: string }>)
              .map((c) => c.code)
              .filter(Boolean)
              .slice(0, 5)
          : null,
      }),
    );
    process.exitCode = 1;
    return;
  }

  const outDir = resolve(process.cwd(), "../../.local/audit-imp05");
  mkdirSync(outDir, { recursive: true });
  const tokenPath = resolve(outDir, "ephemeral-payment-token.env");
  writeFileSync(
    tokenPath,
    `MERCADOPAGO_TEST_PAYMENT_TOKEN=${token}\nMERCADOPAGO_TEST_PAYMENT_METHOD_ID=${paymentMethodId}\n`,
    { mode: 0o600 },
  );

  console.log(
    JSON.stringify({
      ok: true,
      tokenPresent: true,
      tokenPrefix: `${token.slice(0, 6)}…`,
      paymentMethodId,
      wrote: ".local/audit-imp05/ephemeral-payment-token.env",
    }),
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, fatal: String(e).slice(0, 160) }));
  process.exitCode = 1;
});
