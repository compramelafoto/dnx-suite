export type FinancialIdentityReadMode =
  | "LEGACY_ONLY"
  | "PREFER_FINANCIAL_IDENTITY"
  | "FINANCIAL_IDENTITY_ONLY";

export interface FinancialIdentityFlags {
  readMode: FinancialIdentityReadMode;
  writeEnabled: boolean;
  backfillEnabled: boolean;
}

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseReadMode(raw: string | undefined): FinancialIdentityReadMode {
  const v = raw?.trim().toUpperCase();
  if (
    v === "LEGACY_ONLY" ||
    v === "PREFER_FINANCIAL_IDENTITY" ||
    v === "FINANCIAL_IDENTITY_ONLY"
  ) {
    return v;
  }
  // Alias used by CLF docs / local toggles
  if (truthy(process.env.CLF_MP_DUAL_READ) && !raw) {
    return "PREFER_FINANCIAL_IDENTITY";
  }
  // Fail-safe
  return "LEGACY_ONLY";
}

/**
 * Defaults: LEGACY_ONLY everywhere unless explicitly configured.
 * Production must remain LEGACY_ONLY until authorized cutover.
 */
export function loadFinancialIdentityFlags(
  env: NodeJS.ProcessEnv = process.env,
): FinancialIdentityFlags {
  const readMode = parseReadMode(env.DNX_FINANCIAL_IDENTITY_READ_MODE);
  return {
    readMode,
    writeEnabled: truthy(env.DNX_FINANCIAL_IDENTITY_WRITE_ENABLED),
    backfillEnabled: truthy(env.DNX_FINANCIAL_IDENTITY_BACKFILL_ENABLED),
  };
}
