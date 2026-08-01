/**
 * Read-only LIVE payments preflight (10E.4).
 * Never creates Mercado Pago preferences or charges.
 */
import {
  CLICKATON_MP_LIVE_PAYMENTS_FLAG,
  isClickatonLivePaymentsEnabled,
  isClickatonProductionRuntime,
  resolveClickatonPaymentsProviderModeControlled,
  type ClickatonPaymentsProviderMode,
} from "./live-payments-flag";

export type LivePaymentsPreflightInput = {
  env?: NodeJS.ProcessEnv;
  /** Current phase amount in ARS major units (e.g. 25000). */
  expectedAmountArs?: number | null;
  recipientEmail?: string | null;
  recipientPaymentAccountId?: string | null;
  recipientAccountStatus?: string | null;
  recipientAccountEnvironment?: string | null;
  allocationSumPercent?: number | null;
  registrationEnabled?: boolean | null;
  webhookPublicUrl?: string | null;
  callbackBaseUrl?: string | null;
  collectorTokenPresent?: boolean;
  /** Owner payment account id — must remain unchanged (invariant check). */
  ownerPaymentAccountIdExpected?: string | null;
  ownerPaymentAccountIdActual?: string | null;
};

export type LivePaymentsPreflightResult = {
  ok: boolean;
  configuration: "READY_CONFIGURATION" | "CONFIGURATION_INCOMPLETE";
  liveExecution: "OFF" | "ON" | "BLOCKED";
  providerMode: ClickatonPaymentsProviderMode | "UNRESOLVED";
  providerResolveError: string | null;
  checks: Record<string, "PASS" | "FAIL" | "WARN" | "N/A">;
  blockers: string[];
  warnings: string[];
  projected: {
    amountArs: number | null;
    recipientEmail: string | null;
    allocationPercent: number | null;
    environment: string | null;
    charge: "NONE_PREFLIGHT";
  };
  flag: {
    name: typeof CLICKATON_MP_LIVE_PAYMENTS_FLAG;
    enabled: boolean;
  };
  productionRuntime: boolean;
};

function presence(env: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(env[key]?.trim());
}

export function preflightClickatonLivePayments(
  input: LivePaymentsPreflightInput = {},
): LivePaymentsPreflightResult {
  const env = input.env ?? process.env;
  const productionRuntime = isClickatonProductionRuntime(env);
  const liveFlag = isClickatonLivePaymentsEnabled(env);
  const blockers: string[] = [];
  const warnings: string[] = [];
  const checks: LivePaymentsPreflightResult["checks"] = {};

  const providerRaw = (env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual").trim();
  let providerMode: ClickatonPaymentsProviderMode | "UNRESOLVED" = "UNRESOLVED";
  let providerResolveError: string | null = null;

  // Resolve without allowing production unless we want to surface LIVE_PAYMENTS_DISABLED.
  try {
    if (
      providerRaw.toLowerCase() === "mercado_pago_production" ||
      providerRaw.toLowerCase() === "production" ||
      providerRaw.toLowerCase() === "mp_live"
    ) {
      if (!productionRuntime) {
        providerResolveError = "mercado_pago_production_forbidden";
        checks.stagingCannotUseProd = "PASS";
        blockers.push("Staging/non-prod cannot use mercado_pago_production");
      } else if (!liveFlag) {
        providerResolveError = "LIVE_PAYMENTS_DISABLED";
        checks.liveFlagOffBlocksCheckout = "PASS";
        providerMode = "UNRESOLVED";
      } else {
        providerMode = resolveClickatonPaymentsProviderModeControlled(providerRaw, {
          env,
        });
        checks.providerModeLive = "PASS";
      }
    } else {
      providerMode = resolveClickatonPaymentsProviderModeControlled(providerRaw, {
        env,
        allowProductionMode: false,
      });
      checks.providerModeNonLive = "PASS";
    }
  } catch (e) {
    providerResolveError = e instanceof Error ? e.message : "resolve_failed";
    checks.providerResolve = "FAIL";
  }

  const webhook =
    input.webhookPublicUrl ??
    env.DNX_PAYMENTS_WEBHOOK_PUBLIC_URL ??
    (env.CLICKATON_PUBLIC_URL
      ? `${env.CLICKATON_PUBLIC_URL.replace(/\/$/, "")}/api/webhooks/dnx-payments`
      : null);
  const callbackBase =
    input.callbackBaseUrl ?? env.CLICKATON_PUBLIC_URL ?? env.CLICKATON_PUBLIC_WEB_BASE_URL ?? null;

  const webhookOk =
    Boolean(webhook) &&
    /maratonfotografica\.com/i.test(webhook!) &&
    !/staging|localhost|vercel\.app/i.test(webhook!);
  checks.webhookProduction = webhookOk ? "PASS" : "FAIL";
  if (!webhookOk) blockers.push("Webhook URL must be Production maratonfotografica.com");

  const callbackOk =
    Boolean(callbackBase) &&
    /maratonfotografica\.com/i.test(callbackBase!) &&
    !/staging|localhost/i.test(callbackBase!);
  checks.callbackProduction = callbackOk ? "PASS" : productionRuntime ? "FAIL" : "WARN";
  if (productionRuntime && !callbackOk) {
    blockers.push("Callback base must be Production");
  }

  const recipient = input.recipientEmail ?? null;
  const recipientOk = recipient?.toLowerCase() === "dnxfotografia@gmail.com";
  checks.recipient = recipient ? (recipientOk ? "PASS" : "FAIL") : "N/A";
  if (recipient && !recipientOk) blockers.push("Recipient must be dnxfotografia@gmail.com");

  const paStatus = (input.recipientAccountStatus ?? "").toUpperCase();
  const paEnv = (input.recipientAccountEnvironment ?? "").toUpperCase();
  const paOk = paStatus === "ACTIVE" && (paEnv === "PROD" || paEnv === "PRODUCTION" || paEnv === "LIVE");
  checks.recipientAccount = input.recipientPaymentAccountId
    ? paOk
      ? "PASS"
      : "FAIL"
    : "N/A";
  if (input.recipientPaymentAccountId && !paOk) {
    blockers.push("Recipient payment account must be ACTIVE PROD");
  }

  const alloc = input.allocationSumPercent;
  checks.allocation100 =
    alloc == null ? "N/A" : Math.abs(alloc - 100) < 0.001 ? "PASS" : "FAIL";
  if (alloc != null && Math.abs(alloc - 100) >= 0.001) {
    blockers.push("Allocation must total 100%");
  }

  const amount = input.expectedAmountArs ?? null;
  checks.amount = amount == null ? "N/A" : amount > 0 ? "PASS" : "FAIL";

  const collectorOk = input.collectorTokenPresent !== false;
  // Presence of vault/oauth is ops; preflight only warns if explicitly false.
  if (input.collectorTokenPresent === false) {
    checks.collectorCredentials = "FAIL";
    blockers.push("Collector OAuth credentials missing");
  } else {
    checks.collectorCredentials =
      presence(env, "DNX_FINANCIAL_CREDENTIAL_MASTER_KEY") ||
      input.collectorTokenPresent === true
        ? "PASS"
        : "WARN";
  }

  if (
    input.ownerPaymentAccountIdExpected &&
    input.ownerPaymentAccountIdActual &&
    input.ownerPaymentAccountIdExpected !== input.ownerPaymentAccountIdActual
  ) {
    checks.ownerInvariant = "FAIL";
    blockers.push("Owner payment account mutated unexpectedly");
  } else if (input.ownerPaymentAccountIdExpected) {
    checks.ownerInvariant = "PASS";
  }

  if (input.registrationEnabled === true) {
    warnings.push("registrationEnabled=true (public registrations open)");
    checks.registrationClosed = "WARN";
  } else {
    checks.registrationClosed = "PASS";
  }

  checks.liveFlag = liveFlag ? "WARN" : "PASS";
  checks.productionRuntime = productionRuntime ? "PASS" : "WARN";

  const configReady =
    webhookOk &&
    (alloc == null || Math.abs(alloc - 100) < 0.001) &&
    (!recipient || recipientOk) &&
    (!input.recipientPaymentAccountId || paOk) &&
    !blockers.some((b) => b.includes("Owner"));

  let liveExecution: LivePaymentsPreflightResult["liveExecution"] = "OFF";
  if (!productionRuntime && providerResolveError === "mercado_pago_production_forbidden") {
    liveExecution = "BLOCKED";
  } else if (liveFlag && providerMode === "mercado_pago_production") {
    liveExecution = "ON";
  } else if (liveFlag) {
    liveExecution = "ON";
  } else {
    liveExecution = "OFF";
  }

  // Configuration can be READY while LIVE execution is OFF (desired for 10E.4).
  const configuration: LivePaymentsPreflightResult["configuration"] = configReady
    ? "READY_CONFIGURATION"
    : "CONFIGURATION_INCOMPLETE";

  return {
    ok: configuration === "READY_CONFIGURATION" && liveExecution !== "ON",
    configuration,
    liveExecution,
    providerMode,
    providerResolveError,
    checks,
    blockers,
    warnings,
    projected: {
      amountArs: amount,
      recipientEmail: recipient,
      allocationPercent: alloc ?? null,
      environment: paEnv || (productionRuntime ? "PROD" : null),
      charge: "NONE_PREFLIGHT",
    },
    flag: { name: CLICKATON_MP_LIVE_PAYMENTS_FLAG, enabled: liveFlag },
    productionRuntime,
  };
}
