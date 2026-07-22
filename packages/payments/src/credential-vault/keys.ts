import type { FinancialEnvironment } from "../financial-identity/types.js";
import {
  CredentialVaultError,
  type CredentialVaultKeyConfig,
} from "./types.js";

/**
 * Resolve vault key for environment. Fail closed — never fallback to plaintext.
 * TEST uses DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST (preferred) or shared key.
 * PROD uses DNX_FINANCIAL_CREDENTIAL_MASTER_KEY only.
 */
export function loadCredentialVaultKeyConfig(
  environment: FinancialEnvironment,
  env: NodeJS.ProcessEnv = process.env,
): CredentialVaultKeyConfig {
  const keyVersion =
    env.DNX_FINANCIAL_CREDENTIAL_KEY_VERSION?.trim() || "v1";

  if (environment === "TEST") {
    const testKey =
      env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST?.trim() ||
      env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim();
    if (!testKey) {
      throw new CredentialVaultError(
        "MASTER_KEY_MISSING",
        "TEST vault key missing (DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST)",
      );
    }
    return {
      masterKeyBase64: testKey,
      keyVersion,
      environment: "TEST",
    };
  }

  const prodKey = env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim();
  if (!prodKey) {
    throw new CredentialVaultError(
      "MASTER_KEY_MISSING",
      "PROD vault key missing (DNX_FINANCIAL_CREDENTIAL_MASTER_KEY)",
    );
  }
  return {
    masterKeyBase64: prodKey,
    keyVersion,
    environment: "PROD",
  };
}

/** Deterministic 32-byte TEST key for unit tests only (not a real secret). */
export const UNIT_TEST_MASTER_KEY_BASE64 = Buffer.from(
  "dnx-fi-unit-test-key-32-bytes!!!",
  "utf8",
).toString("base64");
