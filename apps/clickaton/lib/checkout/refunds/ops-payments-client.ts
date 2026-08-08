import type { DurableDnxPaymentsClient } from "@/lib/checkout/infrastructure/durable-dnx-payments-client";

const CANONICAL_LIVE_COLLECTOR_PA = "pa_ba733fa7a35f4326";

function isClickatonProductionDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const db = u.pathname.replace(/^\//, "").split("?")[0] || "";
    return host.includes("silent-haze") && db === "clickaton_production";
  } catch {
    return false;
  }
}

/**
 * Bootstrap LIVE ops contra Clickatón production.
 * Necesario porque `vercel env pull` no desencripta provider/LIVE flags.
 * No loguea tokens.
 */
async function ensureProductionOpsBridge(): Promise<{ ok: true } | { ok: false; error: string }> {
  const dbUrl = process.env.DATABASE_URL ?? "";
  const looksProdDb = isClickatonProductionDatabaseUrl(dbUrl);
  const looksProdEnv =
    process.env.VERCEL_ENV === "production" ||
    process.env.DNX_ENVIRONMENT === "production";

  if (!looksProdDb && !looksProdEnv) {
    return { ok: true };
  }

  if (!looksProdDb) {
    return { ok: false, error: "ops_requires_clickaton_production_database" };
  }

  process.env.DNX_ENVIRONMENT = process.env.DNX_ENVIRONMENT || "production";
  process.env.VERCEL_ENV = process.env.VERCEL_ENV || "production";
  process.env.CLICKATON_DNX_PAYMENTS_PROVIDER =
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER?.trim() || "mercado_pago_production";
  process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED =
    process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED?.trim() || "true";

  const existing =
    process.env.MERCADOPAGO_LIVE_ACCESS_TOKEN?.trim() ||
    process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (existing && existing !== "live-collector-oauth-required") {
    return { ok: true };
  }

  if (!process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim()) {
    return { ok: false, error: "master_key_absent_for_ops_vault" };
  }

  try {
    const { resolveCollectorAccessTokenFromPaymentAccount } = await import(
      "@/lib/admin/edition-finance/infrastructure/resolve-collector-token"
    );
    const resolved = await resolveCollectorAccessTokenFromPaymentAccount(
      CANONICAL_LIVE_COLLECTOR_PA,
    );
    if (!resolved.ok) {
      return { ok: false, error: `vault_${resolved.code}` };
    }
    process.env.MERCADOPAGO_LIVE_ACCESS_TOKEN = resolved.accessToken;
    // Invalidar caches de runtime para que el bridge LIVE use el token fresco.
    const g = globalThis as unknown as {
      __clickatonCheckoutService?: unknown;
      __clickatonDnxPaymentsClient?: unknown;
    };
    delete g.__clickatonCheckoutService;
    delete g.__clickatonDnxPaymentsClient;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "ops_vault_failed",
    };
  }
}

/**
 * Acceso ops al cliente durable (scripts / cron).
 * No expone tokens; reutiliza el wiring de runtime.
 */
export async function getDurablePaymentsClientForOps(): Promise<
  | { ok: true; client: DurableDnxPaymentsClient }
  | { ok: false; error: string }
> {
  const boot = await ensureProductionOpsBridge();
  if (!boot.ok) return boot;

  const { buildPaymentsClientForOps } = await import("@/lib/checkout/actions/runtime");
  if (typeof buildPaymentsClientForOps !== "function") {
    return { ok: false, error: "ops_client_unavailable" };
  }
  try {
    const client = buildPaymentsClientForOps();
    return { ok: true, client: client as DurableDnxPaymentsClient };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message.slice(0, 120) : "ops_client_failed",
    };
  }
}
