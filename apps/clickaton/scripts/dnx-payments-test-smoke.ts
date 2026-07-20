/**
 * Smoke externo DNX Payments / Mercado Pago TEST.
 *
 * Modos:
 *   --check-config   (default si no hay --execute) — sin órdenes ni cobros
 *   --execute --confirm-test-only — solo si todos los controles TEST están verdes
 *
 * Nunca imprime secretos. Rechaza producción. No toca Neon prod. No hace push.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  classifySmokeDatabaseUrl,
  isProductionLikeDatabaseUrl,
} from "./lib/classify-smoke-database-url.ts";

const ROOT = join(process.cwd());

type Check = { name: string; ok: boolean; note: string };

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function present(name: string): boolean {
  const v = (process.env as Record<string, string | undefined>)[name];
  return typeof v === "string" && v.trim().length > 0;
}

function readEnv(name: string): string | undefined {
  const v = (process.env as Record<string, string | undefined>)[name]?.trim();
  return v || undefined;
}

function isHttpsPublic(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname !== "localhost";
  } catch {
    return false;
  }
}

function gitHead(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: join(ROOT, "../.."), encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function isAncestor(commit: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${commit} HEAD`, {
      cwd: join(ROOT, "../.."),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const execute = hasFlag("--execute");
  const confirm = hasFlag("--confirm-test-only");
  const checkConfig = hasFlag("--check-config") || !execute;

  console.log("=== dnx-payments-test-smoke ===");
  console.log(`mode=${execute ? "EXECUTE" : "CHECK-CONFIG"}`);
  console.log(`confirm_test_only=${confirm}`);
  console.log(`local_head=${gitHead().slice(0, 12)}`);

  const checks: Check[] = [];
  let blockedReason:
    | "CREDENCIALES"
    | "DEPLOYMENT"
    | "BASE"
    | "ADAPTER"
    | "PRODUCCION"
    | null = null;

  // Local code: adapter present
  const adapterPath = join(
    ROOT,
    "../../packages/payments/src/providers/mercado-pago/checkout-pro/preference-adapter.ts",
  );
  const adapterOk = existsSync(adapterPath);
  checks.push({
    name: "adapter.checkout_pro_preferences",
    ok: adapterOk,
    note: adapterOk ? "present" : "missing",
  });
  if (!adapterOk) blockedReason = "ADAPTER";

  const providerMode = readEnv("CLICKATON_DNX_PAYMENTS_PROVIDER") ?? "manual";
  checks.push({
    name: "provider.mode",
    ok: providerMode === "manual" || providerMode === "mercado_pago_test",
    note: providerMode,
  });
  if (providerMode === "mercado_pago_production") blockedReason = "PRODUCCION";

  for (const key of [
    "MERCADOPAGO_TEST_ACCESS_TOKEN",
    "MERCADOPAGO_TEST_PUBLIC_KEY",
    "MERCADOPAGO_CREDENTIALS_SOURCE",
    "DNX_PAYMENTS_WEBHOOK_SECRET",
    "DNX_PAYMENTS_WEBHOOK_PUBLIC_URL",
    "CLICKATON_PUBLIC_URL",
    "DATABASE_URL",
  ]) {
    checks.push({
      name: `env.${key}`,
      ok: present(key),
      note: present(key) ? "present" : "absent",
    });
  }

  const dbUrl = readEnv("DATABASE_URL");
  const dbClass = classifySmokeDatabaseUrl(dbUrl);
  const dbProd = isProductionLikeDatabaseUrl(dbUrl);
  checks.push({
    name: "db.not_production",
    ok: !dbProd,
    note: dbUrl
      ? dbProd
        ? `REJECT ${dbClass.classification}/${dbClass.reason}`
        : `${dbClass.classification}/${dbClass.reason}`
      : "absent",
  });
  checks.push({
    name: "db.safe_for_test_smoke",
    ok: dbClass.safeForTestSmoke,
    note: dbUrl
      ? dbClass.safeForTestSmoke
        ? `${dbClass.classification} ok`
        : `BLOCK ${dbClass.classification}/${dbClass.reason}`
      : "absent",
  });
  if (dbProd) blockedReason = "PRODUCCION";
  else if (dbUrl && !dbClass.safeForTestSmoke) blockedReason = blockedReason ?? "BASE";

  const publicUrl = readEnv("CLICKATON_PUBLIC_URL");
  const webhookUrl =
    readEnv("DNX_PAYMENTS_WEBHOOK_PUBLIC_URL") ??
    (publicUrl ? `${publicUrl.replace(/\/$/, "")}/api/webhooks/dnx-payments` : undefined);
  checks.push({
    name: "url.public_https_staging",
    ok: isHttpsPublic(publicUrl),
    note: publicUrl ? (isHttpsPublic(publicUrl) ? "https public" : "not https staging") : "absent",
  });
  checks.push({
    name: "url.webhook_https",
    ok: isHttpsPublic(webhookUrl),
    note: webhookUrl ? (isHttpsPublic(webhookUrl) ? "https" : "invalid") : "absent",
  });

  // Credential classification (fail-closed for APP_USR without attestation + seller)
  let credSafe = false;
  if (present("MERCADOPAGO_TEST_ACCESS_TOKEN")) {
    const { validateMercadoPagoTestCredentials } = await import("@repo/payments/next");
    const token = readEnv("MERCADOPAGO_TEST_ACCESS_TOKEN")!;
    const sourceRaw = readEnv("MERCADOPAGO_CREDENTIALS_SOURCE") ?? "unknown";
    const credentialsSource =
      sourceRaw === "credenciales_de_prueba"
        ? "credenciales_de_prueba"
        : sourceRaw === "production_panel"
          ? "production_panel"
          : "unknown";
    const result = await validateMercadoPagoTestCredentials({
      accessToken: token,
      declaredEnvironment: "sandbox",
      credentialsSource,
      // No network users/me in check-config unless explicitly allowed later
    });
    credSafe = result.safeToExecute;
    checks.push({
      name: "mp.credentials_safe_to_execute",
      ok: credSafe,
      note: `${result.environment}/${result.sellerType}/${result.reason}`,
    });
    if (!credSafe) blockedReason = blockedReason ?? "CREDENCIALES";
  } else {
    checks.push({
      name: "mp.credentials_safe_to_execute",
      ok: false,
      note: "token absent",
    });
    blockedReason = blockedReason ?? "CREDENCIALES";
  }

  // Staging deploy ancestry (local knowledge: require eefc001 as ancestor of deployed commit — operator fills)
  const requiredAncestor = "eefc001";
  const localHas = isAncestor(requiredAncestor);
  checks.push({
    name: "git.local_has_10d3h",
    ok: localHas,
    note: localHas ? `${requiredAncestor} ancestor of HEAD` : "missing ancestor",
  });
  const deployedSha = readEnv("CLICKATON_STAGING_DEPLOYED_SHA");
  if (deployedSha) {
    checks.push({
      name: "staging.deployed_sha_declared",
      ok: Boolean(deployedSha),
      note: `declared=${deployedSha.slice(0, 12)} (operator attestation)`,
    });
    if (!deployedSha.startsWith("eefc001") && deployedSha !== gitHead()) {
      checks.push({
        name: "staging.commit_vs_head",
        ok: false,
        note: "declared deploy ≠ HEAD — treat as blocked until verified",
      });
      blockedReason = blockedReason ?? "DEPLOYMENT";
    }
  } else {
    checks.push({
      name: "staging.deployed_sha_declared",
      ok: false,
      note: "CLICKATON_STAGING_DEPLOYED_SHA absent — deploy not verified",
    });
    blockedReason = blockedReason ?? "DEPLOYMENT";
  }

  // Buyer TEST attestation (never print)
  checks.push({
    name: "mp.buyer_test_attested",
    ok: present("MERCADOPAGO_TEST_BUYER_EMAIL"),
    note: present("MERCADOPAGO_TEST_BUYER_EMAIL") ? "present" : "absent",
  });

  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed += 1;
    console.log(`[${c.ok ? "OK" : "BLOCK"}] ${c.name}: ${c.note}`);
  }

  if (checkConfig && !execute) {
    console.log("");
    console.log(
      failed === 0
        ? "CHECK-CONFIG: all green (still requires operator deploy attestation for execute)."
        : `CHECK-CONFIG: ${failed} blocking check(s). blocked=${blockedReason ?? "PARTIAL"}`,
    );
    console.log("No HTTP payment calls. No DB writes. No MP preference create.");
    process.exit(failed > 0 ? 2 : 0);
  }

  if (!confirm) {
    console.error("ABORT: --execute requires --confirm-test-only");
    process.exit(2);
  }
  if (dbProd || !dbClass.safeForTestSmoke) {
    console.error("ABORT: DATABASE_URL not safe for TEST smoke");
    process.exit(2);
  }
  if (providerMode !== "mercado_pago_test") {
    console.error("ABORT: set CLICKATON_DNX_PAYMENTS_PROVIDER=mercado_pago_test");
    process.exit(2);
  }
  if (!credSafe) {
    console.error("ABORT: credentials not safeToExecute (fail-closed)");
    process.exit(2);
  }
  if (blockedReason === "DEPLOYMENT" || !isHttpsPublic(publicUrl) || !isHttpsPublic(webhookUrl)) {
    console.error("ABORT: staging/URL controls failed");
    process.exit(2);
  }

  console.error(
    "ABORT: execute path reserved for 10D3H-C after manual staging deploy + verified TEST seller via /users/me.",
  );
  process.exit(2);
}

void main();
