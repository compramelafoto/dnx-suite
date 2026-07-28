/**
 * Cifrado local AES-256-GCM para tokens sociales.
 * No reutiliza DnxEncryptedCredential (pagos). Env: DNX_SOCIAL_VAULT_MASTER_KEY (base64 32 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SocialPublisherError } from "./types";

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

export function decodeSocialMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== 32) {
    throw new SocialPublisherError(
      "INVALID_MASTER_KEY",
      "DNX_SOCIAL_VAULT_MASTER_KEY must be 32 bytes base64",
    );
  }
  return key;
}

export function encryptSecret(plaintext: string, masterKey: Buffer): EncryptedBlob {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(parts: EncryptedBlob, masterKey: Buffer): string {
  try {
    const decipher = createDecipheriv(
      ALGO,
      masterKey,
      Buffer.from(parts.nonce, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parts.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SocialPublisherError("DECRYPT_FAILED", "social credential decrypt failed");
  }
}

export function tryLoadSocialMasterKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Buffer | null {
  const raw = env.DNX_SOCIAL_VAULT_MASTER_KEY?.trim();
  if (!raw) return null;
  try {
    return decodeSocialMasterKey(raw);
  } catch {
    return null;
  }
}
