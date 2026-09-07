import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado local AES-256-GCM para las credenciales de integraciones con terceros.
 *
 * Clave maestra propia (`DNX_INTEGRATIONS_VAULT_MASTER_KEY`), distinta de la de social y
 * de la de pagos: una clave por dominio, para que rotar una no obligue a rotar las otras.
 *
 * El código es deliberadamente parecido a `packages/social-publisher/src/vault.ts`. No se
 * importa de ahí: son dominios que no deben quedar atados por una dependencia.
 *
 * Módulo PURO: sin base y sin red.
 */

const ALGO = "aes-256-gcm";
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

/** Versión de esquema de cifrado. Cambia solo si cambia el algoritmo. */
export const INTEGRATIONS_KEY_VERSION = "v1";
export const INTEGRATIONS_MASTER_KEY_ENV = "DNX_INTEGRATIONS_VAULT_MASTER_KEY";

export type IntegrationsVaultErrorCode =
  | "MISSING_MASTER_KEY"
  | "INVALID_MASTER_KEY"
  | "DECRYPT_FAILED";

export class IntegrationsVaultError extends Error {
  readonly code: IntegrationsVaultErrorCode;
  constructor(code: IntegrationsVaultErrorCode, message: string) {
    super(message);
    this.name = "IntegrationsVaultError";
    this.code = code;
  }
}

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
};

export function decodeIntegrationsMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new IntegrationsVaultError(
      "INVALID_MASTER_KEY",
      `${INTEGRATIONS_MASTER_KEY_ENV} tiene que ser de 32 bytes en base64.`,
    );
  }
  return key;
}

/**
 * Sin clave maestra no hay dónde cifrar: se corta acá.
 *
 * El mensaje nombra la variable que falta, nunca su valor. No existe camino alternativo
 * que guarde el secreto en claro.
 */
export function requireIntegrationsMasterKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env[INTEGRATIONS_MASTER_KEY_ENV]?.trim();
  if (!raw) {
    throw new IntegrationsVaultError(
      "MISSING_MASTER_KEY",
      `Falta configurar ${INTEGRATIONS_MASTER_KEY_ENV}: no se puede guardar la credencial.`,
    );
  }
  return decodeIntegrationsMasterKey(raw);
}

export function encryptIntegrationSecret(plaintext: string, masterKey: Buffer): EncryptedBlob {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGO, masterKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion: INTEGRATIONS_KEY_VERSION,
  };
}

/**
 * Descifra. Cualquier fallo —clave equivocada, texto alterado, nonce corrupto— sale como
 * un único error sin detalle: distinguirlos le daría información a quien esté probando.
 */
export function decryptIntegrationSecret(blob: EncryptedBlob, masterKey: Buffer): string {
  try {
    const decipher = createDecipheriv(ALGO, masterKey, Buffer.from(blob.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(blob.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new IntegrationsVaultError(
      "DECRYPT_FAILED",
      "No se pudo descifrar la credencial de la integración.",
    );
  }
}
