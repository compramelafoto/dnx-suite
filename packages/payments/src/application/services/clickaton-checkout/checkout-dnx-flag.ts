/**
 * Staging-only flag: Clickatón registration checkout via DNX Payments (10D3I-H).
 * Independent from Orders create/observe flags. Default OFF.
 */
export const CLICKATON_DNX_CHECKOUT_FLAG =
  "DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED" as const;

export function isClickatonDnxCheckoutEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[CLICKATON_DNX_CHECKOUT_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function assertClickatonDnxCheckoutAllowed(input: {
  flagEnabled: boolean;
  environment: "sandbox" | "production";
  confirmStaging: boolean;
  hostOk: boolean;
  databaseOk: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.flagEnabled) return { ok: false, reason: "CHECKOUT_FLAG_OFF" };
  if (input.environment !== "sandbox") {
    return { ok: false, reason: "ENVIRONMENT_NOT_SANDBOX" };
  }
  if (!input.confirmStaging) return { ok: false, reason: "MISSING_CONFIRM_STAGING" };
  if (!input.hostOk || !input.databaseOk) {
    return { ok: false, reason: "STAGING_GATE_FAILED" };
  }
  return { ok: true };
}
