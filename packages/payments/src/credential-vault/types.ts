import type { FinancialEnvironment, FinancialProvider } from "../financial-identity/types.js";

export interface EncryptedCredentialRecord {
  id: string;
  provider: FinancialProvider;
  environment: FinancialEnvironment;
  purpose: string;
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
  createdAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export interface MercadoPagoCredentialPayload {
  accessToken: string;
  refreshToken: string | null;
  providerUserId: string;
  connectedAt: string | null;
  origin: "compramelafoto_legacy_user" | "compramelafoto_legacy_lab";
}

export interface CredentialVaultKeyConfig {
  /** Base64-encoded 32-byte key. Never log. */
  masterKeyBase64: string;
  keyVersion: string;
  environment: FinancialEnvironment;
}

export class CredentialVaultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CredentialVaultError";
    this.code = code;
  }
}
