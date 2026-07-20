/**
 * Validación server-to-server de credenciales Mercado Pago para smoke TEST.
 * Fail-closed: APP_USR- sin evidencia de cuenta TEST no es ejecutable.
 */
import { isTestAccessToken, isSandboxAccessToken } from "../client/mercado-pago-environment";

export type MercadoPagoCredentialEnvironment = "TEST" | "PRODUCTION" | "UNKNOWN";
export type MercadoPagoSellerType = "TEST_USER" | "REAL_USER" | "UNKNOWN";

export type ValidateMercadoPagoTestCredentialsInput = {
  accessToken: string;
  /** Declared environment from config (never production for this stage). */
  declaredEnvironment: "sandbox" | "production";
  /**
   * Operator attestation that the token was copied from "Credenciales de prueba".
   * Required for APP_USR- tokens (official Checkout Pro TEST format).
   */
  credentialsSource?: "credenciales_de_prueba" | "unknown" | "production_panel";
  /** Optional /users/me body already fetched (no token echoed). */
  usersMe?: Record<string, unknown> | null;
  /** Injected GET /users/me — never logs Authorization. */
  fetchUsersMe?: () => Promise<Record<string, unknown>>;
};

export type ValidateMercadoPagoTestCredentialsResult = {
  valid: boolean;
  environment: MercadoPagoCredentialEnvironment;
  sellerType: MercadoPagoSellerType;
  safeToExecute: boolean;
  reason: string;
  /** Sanitized seller hints only. */
  sellerHints?: {
    idPresent: boolean;
    emailDomain?: string;
    nicknameMasked?: string;
    siteId?: string;
  };
};

function maskNickname(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  if (raw.length <= 4) return `${raw[0]}…`;
  return `${raw.slice(0, 3)}…${raw.slice(-2)}`;
}

function emailDomain(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.includes("@")) return undefined;
  return raw.split("@")[1]?.toLowerCase();
}

function classifySeller(usersMe: Record<string, unknown> | null | undefined): {
  sellerType: MercadoPagoSellerType;
  hints: ValidateMercadoPagoTestCredentialsResult["sellerHints"];
} {
  if (!usersMe) {
    return { sellerType: "UNKNOWN", hints: { idPresent: false } };
  }
  const domain = emailDomain(usersMe.email);
  const nickname = typeof usersMe.nickname === "string" ? usersMe.nickname : "";
  const siteId = typeof usersMe.site_id === "string" ? usersMe.site_id : undefined;
  const hints = {
    idPresent: usersMe.id != null,
    ...(domain ? { emailDomain: domain } : {}),
    ...(maskNickname(nickname) ? { nicknameMasked: maskNickname(nickname) } : {}),
    ...(siteId ? { siteId } : {}),
  };

  const isTestUser =
    domain === "testuser.com" ||
    /testuser/i.test(nickname) ||
    (typeof usersMe.tags === "object" &&
      usersMe.tags != null &&
      JSON.stringify(usersMe.tags).toLowerCase().includes("test"));

  if (isTestUser) return { sellerType: "TEST_USER", hints };
  if (usersMe.id != null && domain && domain !== "testuser.com") {
    return { sellerType: "REAL_USER", hints };
  }
  return { sellerType: "UNKNOWN", hints };
}

/**
 * Inocuous classification of MP credentials for Clickatón TEST smoke.
 * Does not create preferences or charges.
 */
export async function validateMercadoPagoTestCredentials(
  input: ValidateMercadoPagoTestCredentialsInput,
): Promise<ValidateMercadoPagoTestCredentialsResult> {
  const token = input.accessToken?.trim() ?? "";
  if (!token) {
    return {
      valid: false,
      environment: "UNKNOWN",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "access_token_absent",
    };
  }

  if (input.declaredEnvironment === "production") {
    return {
      valid: false,
      environment: "PRODUCTION",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "declared_environment_production_forbidden",
    };
  }

  if (input.credentialsSource === "production_panel") {
    return {
      valid: false,
      environment: "PRODUCTION",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "credentials_source_production_panel",
    };
  }

  if (!isSandboxAccessToken(token)) {
    return {
      valid: false,
      environment: "UNKNOWN",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "token_prefix_not_sandbox_eligible",
    };
  }

  let usersMe = input.usersMe ?? null;
  if (!usersMe && input.fetchUsersMe) {
    try {
      usersMe = await input.fetchUsersMe();
    } catch {
      return {
        valid: false,
        environment: "UNKNOWN",
        sellerType: "UNKNOWN",
        safeToExecute: false,
        reason: "users_me_fetch_failed",
      };
    }
  }

  const { sellerType, hints } = classifySeller(usersMe);

  // Legacy TEST- prefix: still require seller TEST when users/me available.
  if (isTestAccessToken(token)) {
    if (sellerType === "REAL_USER") {
      return {
        valid: false,
        environment: "TEST",
        sellerType,
        safeToExecute: false,
        reason: "test_token_but_real_seller",
        sellerHints: hints,
      };
    }
    if (sellerType === "TEST_USER") {
      return {
        valid: true,
        environment: "TEST",
        sellerType,
        safeToExecute: true,
        reason: "test_prefix_and_test_seller",
        sellerHints: hints,
      };
    }
    // TEST- without users/me: not safe until S2S seller proof
    return {
      valid: true,
      environment: "TEST",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "test_prefix_seller_unverified",
      sellerHints: hints,
    };
  }

  // APP_USR-: official Checkout Pro TEST tokens use this prefix too — ambiguous vs production.
  if (token.startsWith("APP_USR-")) {
    if (input.credentialsSource !== "credenciales_de_prueba") {
      return {
        valid: false,
        environment: "UNKNOWN",
        sellerType,
        safeToExecute: false,
        reason: "app_usr_without_credenciales_de_prueba_attestation",
        sellerHints: hints,
      };
    }
    if (sellerType === "TEST_USER") {
      return {
        valid: true,
        environment: "TEST",
        sellerType,
        safeToExecute: true,
        reason: "app_usr_attested_and_test_seller_verified",
        sellerHints: hints,
      };
    }
    if (sellerType === "REAL_USER") {
      return {
        valid: false,
        environment: "PRODUCTION",
        sellerType,
        safeToExecute: false,
        reason: "app_usr_maps_to_real_seller",
        sellerHints: hints,
      };
    }
    return {
      valid: false,
      environment: "UNKNOWN",
      sellerType: "UNKNOWN",
      safeToExecute: false,
      reason: "app_usr_ambiguous_seller_unverified",
      sellerHints: hints,
    };
  }

  return {
    valid: false,
    environment: "UNKNOWN",
    sellerType: "UNKNOWN",
    safeToExecute: false,
    reason: "unrecognized_token_shape",
  };
}
