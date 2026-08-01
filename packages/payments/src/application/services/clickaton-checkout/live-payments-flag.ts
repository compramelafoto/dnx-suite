/**
 * Controlled LIVE payments for Clickatón (10E.4).
 *
 * Historical guard `mercado_pago_production_forbidden` blocked ALL production
 * checkouts while TEST/sandbox was the only supported path. LIVE is now
 * opt-in via explicit Production runtime + this flag (default OFF).
 *
 * Staging/preview must never create LIVE checkouts.
 */
export const CLICKATON_MP_LIVE_PAYMENTS_FLAG =
  "DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED" as const;

export type ClickatonPaymentsProviderMode =
  | "manual"
  | "mercado_pago_test"
  | "mercado_pago_orders_test"
  | "mercado_pago_production";

export function isClickatonProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const vercel = (env.VERCEL_ENV ?? "").trim().toLowerCase();
  const dnx = (env.DNX_ENVIRONMENT ?? "").trim().toLowerCase();
  return vercel === "production" || dnx === "production";
}

export function isClickatonLivePaymentsEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[CLICKATON_MP_LIVE_PAYMENTS_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type ResolveProviderModeOptions = {
  env?: NodeJS.ProcessEnv;
  /** When false, never return production mode (tests). Default true. */
  allowProductionMode?: boolean;
};

/**
 * Resolve provider mode. Production mode requires Production runtime + LIVE flag.
 * Fail-closed codes:
 * - mercado_pago_production_forbidden — non-production runtime requesting LIVE
 * - LIVE_PAYMENTS_DISABLED — Production runtime but flag OFF
 */
export function resolveClickatonPaymentsProviderModeControlled(
  raw: string | undefined,
  opts?: ResolveProviderModeOptions,
): ClickatonPaymentsProviderMode {
  const env = opts?.env ?? process.env;
  const allowProduction = opts?.allowProductionMode !== false;
  const v = (raw ?? "manual").trim().toLowerCase();

  if (v === "mercado_pago_test" || v === "mercadopago_test" || v === "mp_test") {
    return "mercado_pago_test";
  }
  if (
    v === "mercado_pago_orders_test" ||
    v === "mercadopago_orders_test" ||
    v === "mp_orders_test" ||
    v === "orders_1n_test"
  ) {
    return "mercado_pago_orders_test";
  }
  if (v === "manual" || v === "" || v === "fake") return "manual";

  if (v === "mercado_pago_production" || v === "production" || v === "mp_live") {
    if (!allowProduction || !isClickatonProductionRuntime(env)) {
      throw new Error("mercado_pago_production_forbidden");
    }
    if (!isClickatonLivePaymentsEnabled(env)) {
      throw new Error("LIVE_PAYMENTS_DISABLED");
    }
    return "mercado_pago_production";
  }

  throw new Error(`unknown_clickaton_payments_provider:${v}`);
}

export function assertLivePaymentsExecutionAllowed(input: {
  bridgeMode: ClickatonPaymentsProviderMode;
  environment: "sandbox" | "production";
  liveFlagEnabled: boolean;
  productionRuntime: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.bridgeMode !== "mercado_pago_production") {
    if (input.environment === "production") {
      return { ok: false, reason: "PRODUCTION_ENV_WITHOUT_LIVE_BRIDGE" };
    }
    return { ok: true };
  }
  if (!input.productionRuntime) {
    return { ok: false, reason: "mercado_pago_production_forbidden" };
  }
  if (!input.liveFlagEnabled) {
    return { ok: false, reason: "LIVE_PAYMENTS_DISABLED" };
  }
  if (input.environment !== "production") {
    return { ok: false, reason: "LIVE_BRIDGE_REQUIRES_PRODUCTION_ENV" };
  }
  return { ok: true };
}
