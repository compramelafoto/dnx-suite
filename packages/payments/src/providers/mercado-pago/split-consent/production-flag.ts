/**
 * Gate for split consent WRITES (invite / cancel) in Production.
 *
 * Historically these operations were hard-blocked to sandbox ("Etapa 03"). That gate was
 * ours, not Mercado Pago's: the provider supports `/v1/split-consent` in Production.
 *
 * Splitting to 3+ receivers requires each receiver to consent once, and the consent can
 * only be granted by the receiver on Mercado Pago's side — so the platform must be able to
 * send the invite in Production for the feature to work at all.
 *
 * Default OFF: enabling Production writes is deliberate, never incidental. Reads (`list`,
 * `getConsent`) were never gated and stay open.
 */

export const SPLIT_CONSENT_PRODUCTION_FLAG =
  "DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED" as const;

export type SplitConsentWriteDenial =
  | "UNKNOWN_ENVIRONMENT"
  | "PRODUCTION_FLAG_OFF";

export interface SplitConsentWriteGateInput {
  environment: "sandbox" | "production" | string;
  /** Whether Production writes are explicitly enabled. */
  productionEnabled: boolean;
}

export function isSplitConsentProductionEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[SPLIT_CONSENT_PRODUCTION_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Decides whether a split consent write may proceed.
 *
 * Sandbox is always allowed. Production requires the flag. Any other environment is
 * denied: an unrecognised value must never be treated as sandbox.
 */
export function assertSplitConsentWriteAllowed(
  input: SplitConsentWriteGateInput,
): { ok: true } | { ok: false; reason: SplitConsentWriteDenial } {
  if (input.environment === "sandbox") return { ok: true };
  if (input.environment !== "production") {
    return { ok: false, reason: "UNKNOWN_ENVIRONMENT" };
  }
  if (!input.productionEnabled) return { ok: false, reason: "PRODUCTION_FLAG_OFF" };
  return { ok: true };
}
