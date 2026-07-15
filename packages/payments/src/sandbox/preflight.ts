import { isTestAccessToken, MP_API_BASE_URL } from "../providers/mercado-pago/client/mercado-pago-environment.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export type SandboxPreflightStatus =
  | "READY"
  | "MISSING_TEST_TOKEN"
  | "INVALID_TEST_OWNER"
  | "INVALID_TEST_PARTNER"
  | "BLOCKED_BY_TEST_PARTNER_EMAIL"
  | "PRODUCTION_TOKEN_REJECTED"
  | "CONFIRMATION_REQUIRED"
  | "BLOCKED_BY_SANDBOX_CREDENTIALS"
  | "BLOCKED_BY_TEST_PAYMENT_TOKEN";

export interface SandboxPreflightInput {
  accessToken?: string | undefined;
  publicKey?: string | undefined;
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

export interface SandboxCredentialAuditRow {
  name: string;
  present: boolean;
  formatValid: boolean;
  reason: string;
}

export interface SandboxPreflightResult {
  status: SandboxPreflightStatus;
  checks: {
    tokenPresent: boolean;
    tokenIsTest: boolean;
    tokenIsProductionPrefixed: boolean;
    publicKeyPresent: boolean;
    publicKeyLooksTest: boolean;
    ownerPresent: boolean;
    ownerLooksNumeric: boolean;
    partnerPresent: boolean;
    partnerIsTestUser: boolean;
    partnerLooksLikeUserId: boolean;
    environmentSandbox: boolean;
    baseUrlOfficial: boolean;
    productionGuardActive: boolean;
    confirmed: boolean;
    paymentTokenPresent: boolean;
    deviceIdPresent: boolean;
  };
  /** Never includes secrets. */
  hints: string[];
  credentialAudit: SandboxCredentialAuditRow[];
}

const TESTUSER_EMAIL_RE = /^TESTUSER.+@testuser\.com$/i;
const NUMERIC_ID_RE = /^\d+$/;

export function isTestPartnerEmail(email: string): boolean {
  return TESTUSER_EMAIL_RE.test(email.trim());
}

export function isNumericOwnerUserId(ownerUserId: string): boolean {
  return NUMERIC_ID_RE.test(ownerUserId.trim());
}

export function auditSandboxCredentials(input: SandboxPreflightInput): SandboxCredentialAuditRow[] {
  const token = input.accessToken?.trim() ?? "";
  const publicKey = input.publicKey?.trim() ?? "";
  const owner = input.ownerUserId?.trim() ?? "";
  const partner = input.partnerEmail?.trim() ?? "";
  const deviceId = input.deviceId?.trim() ?? "";
  const paymentToken = input.paymentToken?.trim() ?? "";

  return [
    {
      name: "MERCADOPAGO_TEST_ACCESS_TOKEN",
      present: token.length > 0,
      formatValid: token.startsWith("TEST-"),
      reason: !token
        ? "missing"
        : token.startsWith("APP_USR-")
          ? "APP_USR_REJECTED"
          : token.startsWith("TEST-")
            ? "TEST_prefix_ok"
            : "unexpected_prefix",
    },
    {
      name: "MERCADOPAGO_TEST_PUBLIC_KEY",
      present: publicKey.length > 0,
      formatValid: publicKey.startsWith("TEST-"),
      reason: !publicKey
        ? "missing"
        : publicKey.startsWith("TEST-")
          ? "TEST_prefix_ok"
          : publicKey.startsWith("APP_USR-")
            ? "APP_USR_not_accepted_for_sandbox_policy"
            : "unexpected_prefix",
    },
    {
      name: "MERCADOPAGO_TEST_OWNER_USER_ID",
      present: owner.length > 0,
      formatValid: isNumericOwnerUserId(owner),
      reason: !owner
        ? "missing"
        : owner.includes("@")
          ? "email_not_allowed"
          : isNumericOwnerUserId(owner)
            ? "numeric_ok"
            : "not_numeric",
    },
    {
      name: "MERCADOPAGO_TEST_PARTNER_EMAIL",
      present: partner.length > 0,
      formatValid: isTestPartnerEmail(partner),
      reason: !partner
        ? "missing"
        : NUMERIC_ID_RE.test(partner)
          ? "user_id_not_email"
          : isTestPartnerEmail(partner)
            ? "testuser_email_ok"
            : partner.includes("@")
              ? "non_testuser_email"
              : "invalid_email",
    },
    {
      name: "MERCADOPAGO_TEST_DEVICE_ID",
      present: deviceId.length > 0,
      formatValid: deviceId.length >= 8,
      reason: !deviceId ? "missing" : deviceId.length >= 8 ? "present_ok" : "too_short",
    },
    {
      name: "MERCADOPAGO_TEST_PAYMENT_TOKEN",
      present: paymentToken.length > 0,
      formatValid: paymentToken.length >= 8,
      reason: !paymentToken ? "missing" : paymentToken.length >= 8 ? "present_ok" : "too_short",
    },
  ];
}

export function runSandboxPreflight(input: SandboxPreflightInput): SandboxPreflightResult {
  const token = input.accessToken?.trim() ?? "";
  const publicKey = input.publicKey?.trim() ?? "";
  const owner = input.ownerUserId?.trim() ?? "";
  const partner = input.partnerEmail?.trim() ?? "";
  const environment = input.environment ?? "sandbox";
  const baseUrl = (input.baseUrl ?? MP_API_BASE_URL).replace(/\/$/, "");
  const confirmed = Boolean(input.confirm);
  const dryRun = Boolean(input.dryRun);

  const tokenPresent = token.length > 0;
  const tokenIsTest = tokenPresent && isTestAccessToken(token);
  const tokenIsProductionPrefixed = token.startsWith("APP_USR-");
  const publicKeyPresent = publicKey.length > 0;
  const publicKeyLooksTest = publicKey.startsWith("TEST-");
  const ownerPresent = owner.length > 0;
  const ownerLooksNumeric = isNumericOwnerUserId(owner);
  const partnerPresent = partner.length > 0;
  const partnerLooksLikeUserId = partnerPresent && NUMERIC_ID_RE.test(partner);
  const partnerIsTestUser = partnerPresent && isTestPartnerEmail(partner);
  const environmentSandbox = environment === "sandbox";
  const baseUrlOfficial = baseUrl === MP_API_BASE_URL;
  const paymentTokenPresent = Boolean(input.paymentToken?.trim());
  const deviceIdPresent = Boolean(input.deviceId?.trim());
  const credentialAudit = auditSandboxCredentials(input);

  const hints: string[] = [];
  const checks = {
    tokenPresent,
    tokenIsTest,
    tokenIsProductionPrefixed,
    publicKeyPresent,
    publicKeyLooksTest,
    ownerPresent,
    ownerLooksNumeric,
    partnerPresent,
    partnerIsTestUser,
    partnerLooksLikeUserId,
    environmentSandbox,
    baseUrlOfficial,
    productionGuardActive: true,
    confirmed,
    paymentTokenPresent,
    deviceIdPresent,
  };

  if (!environmentSandbox) {
    hints.push("environment must be sandbox");
    return { status: "PRODUCTION_TOKEN_REJECTED", checks, hints, credentialAudit };
  }

  if (tokenIsProductionPrefixed) {
    hints.push(
      "MERCADOPAGO_TEST_ACCESS_TOKEN starts with APP_USR- — use Credenciales de prueba (TEST-), not Production",
    );
    return { status: "PRODUCTION_TOKEN_REJECTED", checks, hints, credentialAudit };
  }

  if (!tokenPresent || !tokenIsTest) {
    hints.push("Set MERCADOPAGO_TEST_ACCESS_TOKEN (TEST- prefix required)");
    return {
      status: tokenPresent ? "PRODUCTION_TOKEN_REJECTED" : "MISSING_TEST_TOKEN",
      checks,
      hints,
      credentialAudit,
    };
  }

  if (!ownerPresent || !ownerLooksNumeric) {
    hints.push("Set MERCADOPAGO_TEST_OWNER_USER_ID to a numeric TEST seller id (not email)");
    return { status: "INVALID_TEST_OWNER", checks, hints, credentialAudit };
  }

  if (!partnerPresent || partnerLooksLikeUserId || !partnerIsTestUser) {
    if (partnerLooksLikeUserId) {
      hints.push(
        "Partner must be TESTUSER…@testuser.com email — numeric user ID is not accepted for Split Consent invite",
      );
    } else if (!partnerPresent) {
      hints.push(
        "Create a TEST seller user in MP Developers and set MERCADOPAGO_TEST_PARTNER_EMAIL to the TESTUSER…@testuser.com email shown at creation",
      );
    } else {
      hints.push("Set MERCADOPAGO_TEST_PARTNER_EMAIL to TESTUSER…@testuser.com (no real emails)");
    }
    return { status: "BLOCKED_BY_TEST_PARTNER_EMAIL", checks, hints, credentialAudit };
  }

  if (!baseUrlOfficial) {
    hints.push("baseUrl must be the official Mercado Pago API host");
    return { status: "BLOCKED_BY_SANDBOX_CREDENTIALS", checks, hints, credentialAudit };
  }

  if (input.requirePaymentToken && !paymentTokenPresent) {
    hints.push("Payment token TEST required (MercadoPago.js + public key TEST) — order creation blocked");
    return { status: "BLOCKED_BY_TEST_PAYMENT_TOKEN", checks, hints, credentialAudit };
  }

  if (input.requirePaymentToken && !deviceIdPresent) {
    hints.push("Device ID TEST required for create order");
    return { status: "BLOCKED_BY_TEST_PAYMENT_TOKEN", checks, hints, credentialAudit };
  }

  if (!dryRun && !confirmed) {
    hints.push("Pass --confirm to execute real sandbox writes");
    return { status: "CONFIRMATION_REQUIRED", checks, hints, credentialAudit };
  }

  if (publicKeyPresent && !publicKeyLooksTest) {
    hints.push(
      "Public key is present but not TEST- prefixed; tokenization may fail — prefer Credenciales de prueba",
    );
  }

  return { status: "READY", checks, hints, credentialAudit };
}

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Loads sandbox vars from process.env and optional local env files (never prints values).
 */
export function loadSandboxEnvFromProcess(
  env: NodeJS.ProcessEnv = process.env,
  options?: { cwd?: string },
): SandboxPreflightInput {
  const cwd = options?.cwd ?? process.cwd();
  const candidates = [
    resolve(cwd, "services/dnx-mcp/.env.local"),
    resolve(cwd, "../../services/dnx-mcp/.env.local"),
    resolve(cwd, ".env.local"),
    resolve(cwd, "packages/payments/.env.local"),
  ];
  const fileEnv: Record<string, string> = {};
  for (const path of candidates) {
    Object.assign(fileEnv, parseEnvFile(path));
  }

  const get = (key: string): string | undefined => {
    const fromProc = env[key]?.trim();
    if (fromProc) return fromProc;
    const fromFile = fileEnv[key]?.trim();
    return fromFile || undefined;
  };

  return {
    accessToken: get("MERCADOPAGO_TEST_ACCESS_TOKEN") || get("MERCADOPAGO_ACCESS_TOKEN"),
    publicKey: get("MERCADOPAGO_TEST_PUBLIC_KEY"),
    ownerUserId: get("MERCADOPAGO_TEST_OWNER_USER_ID"),
    partnerEmail: get("MERCADOPAGO_TEST_PARTNER_EMAIL"),
    paymentToken: get("MERCADOPAGO_TEST_PAYMENT_TOKEN"),
    deviceId: get("MERCADOPAGO_TEST_DEVICE_ID"),
    environment: "sandbox",
    baseUrl: MP_API_BASE_URL,
  };
}
