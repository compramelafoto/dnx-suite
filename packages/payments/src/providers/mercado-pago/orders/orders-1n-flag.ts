/**
 * Temporal gate for Mercado Pago Orders 1:N staging TEST creates.
 * Default OFF. Never enables Production.
 */

export const ORDERS_1N_STAGING_FLAG = "DNX_MP_ORDERS_1N_STAGING_ENABLED" as const;

export type Orders1nGateDenial =
  | "FLAG_OFF"
  | "ENVIRONMENT_NOT_SANDBOX"
  | "MISSING_CONFIRM_STAGING"
  | "MISSING_CONFIRM_ORDERS_TEST"
  | "MISSING_PAYMENT_TOKEN"
  | "MISSING_DEVICE_ID"
  | "MISSING_OWNER"
  | "MISSING_RECEIVER_1"
  | "MISSING_RECEIVER_2"
  | "TOKEN_NOT_SANDBOX";

export interface Orders1nGateInput {
  flagEnabled: boolean;
  environment: "sandbox" | "production" | string;
  confirmStaging: boolean;
  confirmOrdersTest: boolean;
  accessTokenPresent: boolean;
  accessTokenSandboxEligible: boolean;
  ownerUserIdPresent: boolean;
  receiver1Present: boolean;
  receiver2Present: boolean;
  paymentTokenPresent: boolean;
  deviceIdPresent: boolean;
}

export function isOrders1nStagingFlagEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = (env[ORDERS_1N_STAGING_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function assertOrders1nStagingCreateAllowed(
  input: Orders1nGateInput,
): { ok: true } | { ok: false; reason: Orders1nGateDenial } {
  if (!input.flagEnabled) return { ok: false, reason: "FLAG_OFF" };
  if (input.environment !== "sandbox") {
    return { ok: false, reason: "ENVIRONMENT_NOT_SANDBOX" };
  }
  if (!input.confirmStaging) {
    return { ok: false, reason: "MISSING_CONFIRM_STAGING" };
  }
  if (!input.confirmOrdersTest) {
    return { ok: false, reason: "MISSING_CONFIRM_ORDERS_TEST" };
  }
  if (!input.accessTokenPresent || !input.accessTokenSandboxEligible) {
    return { ok: false, reason: "TOKEN_NOT_SANDBOX" };
  }
  if (!input.ownerUserIdPresent) return { ok: false, reason: "MISSING_OWNER" };
  if (!input.receiver1Present) return { ok: false, reason: "MISSING_RECEIVER_1" };
  if (!input.receiver2Present) return { ok: false, reason: "MISSING_RECEIVER_2" };
  if (!input.paymentTokenPresent) {
    return { ok: false, reason: "MISSING_PAYMENT_TOKEN" };
  }
  if (!input.deviceIdPresent) return { ok: false, reason: "MISSING_DEVICE_ID" };
  return { ok: true };
}
