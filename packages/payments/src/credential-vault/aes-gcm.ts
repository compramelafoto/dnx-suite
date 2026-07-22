import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { CredentialVaultError } from "./types.js";

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;

export function decodeMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== 32) {
    throw new CredentialVaultError(
      "INVALID_MASTER_KEY",
      "master key must be 32 bytes (base64)",
    );
  }
  return key;
}

export function encryptUtf8(
  plaintext: string,
  masterKey: Buffer,
): { ciphertext: string; nonce: string; authTag: string } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptUtf8(
  parts: { ciphertext: string; nonce: string; authTag: string },
  masterKey: Buffer,
): string {
  try {
    const decipher = createDecipheriv(
      ALGO,
      masterKey,
      Buffer.from(parts.nonce, "base64"),
    );
    decipher.setAuthTag(Buffer.from(parts.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(parts.ciphertext, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new CredentialVaultError(
      "DECRYPT_FAILED",
      "credential decrypt failed (auth tag / key / ciphertext)",
    );
  }
}
