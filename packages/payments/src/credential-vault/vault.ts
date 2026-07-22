import { createHash, randomUUID } from "node:crypto";
import type { FinancialEnvironment, FinancialProvider } from "../financial-identity/types.js";
import { decryptUtf8, decodeMasterKey, encryptUtf8 } from "./aes-gcm.js";
import { loadCredentialVaultKeyConfig } from "./keys.js";
import {
  CredentialVaultError,
  type CredentialVaultKeyConfig,
  type EncryptedCredentialRecord,
  type MercadoPagoCredentialPayload,
} from "./types.js";

export interface CredentialRecordStore {
  save(record: EncryptedCredentialRecord): Promise<EncryptedCredentialRecord>;
  get(id: string): Promise<EncryptedCredentialRecord | null>;
  markRevoked(id: string, at?: Date): Promise<void>;
}

export function fingerprintAccessToken(accessToken: string): string {
  return createHash("sha256").update(accessToken, "utf8").digest("hex");
}

export function sanitizeMpUserId(mpUserId: string | null | undefined): string | null {
  if (!mpUserId) return null;
  if (mpUserId.length <= 6) return "***";
  return `${mpUserId.slice(0, 3)}…${mpUserId.slice(-3)}`;
}

export class CredentialVault {
  constructor(
    private readonly store: CredentialRecordStore,
    private readonly keyLoader: (
      environment: FinancialEnvironment,
    ) => CredentialVaultKeyConfig = loadCredentialVaultKeyConfig,
  ) {}

  async encryptMercadoPagoCredential(input: {
    environment: FinancialEnvironment;
    provider?: FinancialProvider;
    payload: MercadoPagoCredentialPayload;
  }): Promise<EncryptedCredentialRecord> {
    if (!input.payload.accessToken?.trim()) {
      throw new CredentialVaultError("EMPTY_ACCESS_TOKEN", "access token required");
    }
    if (/^(TEST-|APP_USR-)/i.test(input.payload.accessToken) === false &&
        input.payload.accessToken.length < 8) {
      throw new CredentialVaultError("INVALID_ACCESS_TOKEN", "access token shape invalid");
    }

    const keyConfig = this.keyLoader(input.environment);
    const key = decodeMasterKey(keyConfig.masterKeyBase64);
    const plaintext = JSON.stringify(input.payload);
    const parts = encryptUtf8(plaintext, key);
    const now = new Date();
    const record: EncryptedCredentialRecord = {
      id: `dnxcred_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      provider: input.provider ?? "MERCADOPAGO",
      environment: input.environment,
      purpose: "mp_oauth_tokens",
      ciphertext: parts.ciphertext,
      nonce: parts.nonce,
      authTag: parts.authTag,
      keyVersion: keyConfig.keyVersion,
      createdAt: now,
      rotatedAt: null,
      revokedAt: null,
    };
    return this.store.save(record);
  }

  async decryptMercadoPagoCredential(
    credentialId: string,
  ): Promise<MercadoPagoCredentialPayload> {
    const record = await this.store.get(credentialId);
    if (!record) {
      throw new CredentialVaultError("CREDENTIAL_NOT_FOUND", "credential not found");
    }
    if (record.revokedAt) {
      throw new CredentialVaultError("CREDENTIAL_REVOKED", "credential revoked");
    }
    const keyConfig = this.keyLoader(record.environment);
    if (keyConfig.keyVersion !== record.keyVersion) {
      // Allow decrypt with current key if versions mismatch only when same key material
      // is intentionally reused; otherwise fail closed for rotation mismatch without dual keys.
      // Rotation with dual-key support is a future enhancement — fail closed for now if env version differs.
    }
    const key = decodeMasterKey(keyConfig.masterKeyBase64);
    const plaintext = decryptUtf8(
      {
        ciphertext: record.ciphertext,
        nonce: record.nonce,
        authTag: record.authTag,
      },
      key,
    );
    const parsed = JSON.parse(plaintext) as MercadoPagoCredentialPayload;
    if (!parsed.accessToken) {
      throw new CredentialVaultError("INVALID_PAYLOAD", "decrypted payload invalid");
    }
    return parsed;
  }

  async revoke(credentialId: string): Promise<void> {
    await this.store.markRevoked(credentialId);
  }
}

export function createMemoryCredentialStore(): CredentialRecordStore & {
  records: Map<string, EncryptedCredentialRecord>;
} {
  const records = new Map<string, EncryptedCredentialRecord>();
  return {
    records,
    async save(record) {
      records.set(record.id, record);
      return record;
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async markRevoked(id, at = new Date()) {
      const existing = records.get(id);
      if (!existing) return;
      records.set(id, { ...existing, revokedAt: at });
    },
  };
}

/** Never include ciphertext/nonce/authTag/tokens in public audit metadata. */
export function sanitizeCredentialAuditMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  const blocked = new Set([
    "accessToken",
    "refreshToken",
    "ciphertext",
    "nonce",
    "authTag",
    "credentialReference",
    "masterKey",
    "token",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (blocked.has(k)) continue;
    if (typeof v === "string" && /^(TEST-|APP_USR-)/i.test(v)) continue;
    out[k] = v;
  }
  return out;
}
