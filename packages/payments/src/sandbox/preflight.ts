import { isTestAccessToken, MP_API_BASE_URL } from "../providers/mercado-pago/client/mercado-pago-environment.js";

export type SandboxPreflightStatus =
  | "READY"
  | "MISSING_TEST_TOKEN"
  | "INVALID_TEST_OWNER"
  | "INVALID_TEST_PARTNER"
  | "PRODUCTION_TOKEN_REJECTED"
  | "CONFIRMATION_REQUIRED"
  | "BLOCKED_BY_SANDBOX_CREDENTIALS";

export interface SandboxPreflightInput {
  accessToken?: string | undefined;
  ownerUserId?: string | undefined;
  partnerEmail?: string | undefined;
  environment?: "sandbox" | "production" | undefined;
  baseUrl?: string | undefined;
  confirm?: boolean | undefined;
  dryRun?: boolean | undefined;
  requirePaymentToken?: boolean | undefined;
  paymentToken?: string | undefined;
  deviceId?: string | undefined;
}

export interface SandboxPreflightResult {
  status: SandboxPreflightStatus;
  checks: {
    tokenPresent: boolean;
    tokenIsTest: boolean;
    tokenIsProductionPrefixed: boolean;
    ownerPresent: boolean;
    ownerLooksNumeric: boolean;
    partnerPresent: boolean;
    partnerIsTestUser: boolean;
    environmentSandbox: boolean;
    baseUrlOfficial: boolean;
    productionGuardActive: boolean;
    confirmed: boolean;
    paymentTokenPresent: boolean;
    deviceIdPresent: boolean;
  };
  /** Never includes secrets. */
  hints: string[];
}

const TESTUSER_EMAIL_RE = /^TESTUSER.+@testuser\.com$/i;

export function runSandboxPreflight(input: SandboxPreflightInput): SandboxPreflightResult {
  const token = input.accessToken?.trim() ?? "";
  const owner = input.ownerUserId?.trim() ?? "";
  const partner = input.partnerEmail?.trim() ?? "";
  const environment = input.environment ?? "sandbox";
  const baseUrl = (input.baseUrl ?? MP_API_BASE_URL).replace(/\/$/, "");
  const confirmed = Boolean(input.confirm);
  const dryRun = Boolean(input.dryRun);

  const tokenPresent = token.length > 0;
  const tokenIsTest = tokenPresent && isTestAccessToken(token);
  const tokenIsProductionPrefixed = token.startsWith("APP_USR-");
  const ownerPresent = owner.length > 0;
  const ownerLooksNumeric = /^\d+$/.test(owner);
  const partnerPresent = partner.length > 0;
  const partnerIsTestUser = partnerPresent && TESTUSER_EMAIL_RE.test(partner);
  const environmentSandbox = environment === "sandbox";
  const baseUrlOfficial = baseUrl === MP_API_BASE_URL;
  const paymentTokenPresent = Boolean(input.paymentToken?.trim());
  const deviceIdPresent = Boolean(input.deviceId?.trim());

  const hints: string[] = [];
  const checks = {
    tokenPresent,
    tokenIsTest,
    tokenIsProductionPrefixed,
    ownerPresent,
    ownerLooksNumeric,
    partnerPresent,
    partnerIsTestUser,
    environmentSandbox,
    baseUrlOfficial,
    productionGuardActive: true,
    confirmed,
    paymentTokenPresent,
    deviceIdPresent,
  };

  if (!environmentSandbox) {
    hints.push("environment must be sandbox");
    return { status: "PRODUCTION_TOKEN_REJECTED", checks, hints };
  }

  if (tokenIsProductionPrefixed) {
    hints.push("APP_USR- tokens are rejected for sandbox smoke");
    return { status: "PRODUCTION_TOKEN_REJECTED", checks, hints };
  }

  if (!tokenPresent || !tokenIsTest) {
    hints.push("Set MERCADOPAGO_TEST_ACCESS_TOKEN (TEST- prefix required)");
    return {
      status: tokenPresent ? "PRODUCTION_TOKEN_REJECTED" : "MISSING_TEST_TOKEN",
      checks,
      hints,
    };
  }

  if (!ownerPresent || !ownerLooksNumeric) {
    hints.push("Set MERCADOPAGO_TEST_OWNER_USER_ID to a numeric TEST seller id");
    return { status: "INVALID_TEST_OWNER", checks, hints };
  }

  if (!partnerPresent || !partnerIsTestUser) {
    hints.push("Set MERCADOPAGO_TEST_PARTNER_EMAIL to TESTUSER…@testuser.com");
    return { status: "INVALID_TEST_PARTNER", checks, hints };
  }

  if (!baseUrlOfficial) {
    hints.push("baseUrl must be the official Mercado Pago API host");
    return { status: "BLOCKED_BY_SANDBOX_CREDENTIALS", checks, hints };
  }

  if (input.requirePaymentToken && !paymentTokenPresent) {
    hints.push("Payment token TEST required (MercadoPago.js + public key TEST)");
    return { status: "BLOCKED_BY_SANDBOX_CREDENTIALS", checks, hints };
  }

  if (input.requirePaymentToken && !deviceIdPresent) {
    hints.push("Device ID TEST required for create order");
    return { status: "BLOCKED_BY_SANDBOX_CREDENTIALS", checks, hints };
  }

  if (!dryRun && !confirmed) {
    hints.push("Pass --confirm to execute real sandbox writes");
    return { status: "CONFIRMATION_REQUIRED", checks, hints };
  }

  return { status: "READY", checks, hints };
}

export function loadSandboxEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
): SandboxPreflightInput {
  return {
    accessToken:
      env.MERCADOPAGO_TEST_ACCESS_TOKEN?.trim() ||
      env.MERCADOPAGO_ACCESS_TOKEN?.trim() ||
      undefined,
    ownerUserId: env.MERCADOPAGO_TEST_OWNER_USER_ID?.trim() || undefined,
    partnerEmail: env.MERCADOPAGO_TEST_PARTNER_EMAIL?.trim() || undefined,
    paymentToken: env.MERCADOPAGO_TEST_PAYMENT_TOKEN?.trim() || undefined,
    deviceId: env.MERCADOPAGO_TEST_DEVICE_ID?.trim() || undefined,
    environment: "sandbox",
    baseUrl: MP_API_BASE_URL,
  };
}
