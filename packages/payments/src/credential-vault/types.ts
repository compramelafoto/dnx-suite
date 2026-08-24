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

export type MercadoPagoCredentialOrigin =
  | "compramelafoto_legacy_user"
  | "compramelafoto_legacy_lab"
  | "clickaton_owner_oauth"
  | "clickaton_partner_oauth"
  /** Institución que conecta su cuenta desde FotoOffice para cobrar cuotas. */
  | "fotoffice_workspace_oauth";

export interface MercadoPagoCredentialPayload {
  accessToken: string;
  refreshToken: string | null;
  providerUserId: string;
  connectedAt: string | null;
  origin: MercadoPagoCredentialOrigin;
  /** Sanitized scopes granted at connect time (never secrets). */
  scopes?: string[] | null;
  expiresAt?: string | null;
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
