/**
 * Smoke externo DNX Payments / Mercado Pago TEST — dry-run por defecto.
 *
 * Uso:
 *   pnpm --filter clickaton smoke:dnx-payments-test
 *   pnpm --filter clickaton smoke:dnx-payments-test -- --execute --confirm-test-only
 *
 * Nunca imprime secretos. Rechaza producción. No toca Neon prod. No hace push.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

type Check = { name: string; ok: boolean; note: string };

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function present(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

function looksLikeProductionUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.toLowerCase();
  return (
    v.includes("neon.tech") ||
    v.includes("maratonfotografica.com") ||
    (v.includes("vercel.app") && !v.includes("-git-") && !v.includes("preview"))
  );
}

function tokenLooksTest(name: string): boolean | null {
  if (!present(name)) return null;
  const v = process.env[name] ?? "";
  return v.startsWith("TEST-");
}

function readClickatonCheckoutService(): string {
  const candidates = [
    join(ROOT, "../../packages/payments/src/application/services/clickaton-checkout/clickaton-checkout-service.ts"),
    join(ROOT, "../../../packages/payments/src/application/services/clickaton-checkout/clickaton-checkout-service.ts"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return "";
}

function main() {
  const execute = hasFlag("--execute");
  const confirm = hasFlag("--confirm-test-only");
  const dryRun = !execute;

  console.log("=== dnx-payments-test-smoke ===");
  console.log(`mode=${dryRun ? "DRY-RUN" : "EXECUTE"}`);
  console.log(`confirm_test_only=${confirm}`);

  const checks: Check[] = [];

  for (const key of [
    "MERCADOPAGO_TEST_ACCESS_TOKEN",
    "MERCADOPAGO_TEST_PUBLIC_KEY",
    "DNX_PAYMENTS_WEBHOOK_SECRET",
    "CLICKATON_PUBLIC_URL",
    "DATABASE_URL",
  ]) {
    checks.push({
      name: `env.${key}`,
      ok: present(key),
      note: present(key) ? "present" : "absent",
    });
  }

  checks.push({
    name: "env.CLICKATON_DNX_PAYMENTS_MODE",
    ok: true,
    note: present("CLICKATON_DNX_PAYMENTS_MODE")
      ? "present (value hidden)"
      : "absent → default prisma",
  });

  const dbUrl = process.env.DATABASE_URL;
  const dbProd = looksLikeProductionUrl(dbUrl);
  checks.push({
    name: "db.not_production",
    ok: !dbProd,
    note: dbUrl
      ? dbProd
        ? "REJECT production-like DATABASE_URL"
        : "non-production-like host"
      : "DATABASE_URL absent",
  });

  const publicUrl = process.env.CLICKATON_PUBLIC_URL;
  checks.push({
    name: "public_url.https_staging_or_local",
    ok: !publicUrl || publicUrl.startsWith("https://") || publicUrl.includes("localhost"),
    note: publicUrl ? "present (value hidden)" : "absent",
  });

  const mpTestPrefix = tokenLooksTest("MERCADOPAGO_TEST_ACCESS_TOKEN");
  checks.push({
    name: "mp.token_test_prefix",
    ok: mpTestPrefix !== false,
    note:
      mpTestPrefix === null
        ? "token absent"
        : mpTestPrefix
          ? "TEST- prefix detected"
          : "present but not TEST- prefix",
  });

  const serviceSrc = readClickatonCheckoutService();
  const providerManual =
    serviceSrc.includes('PROVIDER = "manual"') || serviceSrc.includes('provider: "manual"');
  checks.push({
    name: "adapter.clickaton_manual_fake",
    ok: true,
    note: providerManual
      ? "Clickatón checkout provider=manual (fake) — Nivel C no cableado"
      : serviceSrc
        ? "provider source reviewed"
        : "service source not found",
  });

  checks.push({
    name: "flags.no_real_money",
    ok: true,
    note: "script never charges real money",
  });

  for (const c of checks) {
    console.log(`[${c.ok ? "OK" : "BLOCK"}] ${c.name}: ${c.note}`);
  }

  if (dryRun) {
    console.log("");
    console.log("DRY-RUN complete. No HTTP calls. No DB writes. No MP API.");
    console.log("To attempt Nivel C (when adapter + staging TEST ready):");
    console.log(
      "  pnpm --filter clickaton smoke:dnx-payments-test -- --execute --confirm-test-only",
    );
    process.exit(0);
  }

  if (!confirm) {
    console.error("ABORT: --execute requires --confirm-test-only");
    process.exit(2);
  }
  if (dbProd) {
    console.error("ABORT: production-like DATABASE_URL rejected");
    process.exit(2);
  }
  if (providerManual) {
    console.error(
      "ABORT: Clickatón checkout still uses provider=manual. Wire Mercado Pago TEST adapter before --execute.",
    );
    process.exit(2);
  }
  if (!present("MERCADOPAGO_TEST_ACCESS_TOKEN") || mpTestPrefix === false) {
    console.error("ABORT: missing or non-TEST Mercado Pago credentials");
    process.exit(2);
  }

  console.error(
    "ABORT: execute path reserved for 10D3H-B once MP TEST adapter is wired end-to-end.",
  );
  process.exit(2);
}

main();
