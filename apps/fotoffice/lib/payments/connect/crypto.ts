import { createCipheriv, createDecipheriv, createHash } from "node:crypto";

/**
 * Cifrado AES-256-GCM para secretos de corta vida del flujo de conexión.
 *
 * Réplica deliberada de `packages/payments/src/credential-vault/aes-gcm.ts`, con el mismo
 * algoritmo, el mismo largo de nonce y el mismo formato de salida.
 *
 * **Por qué no se importa aquel:** FotoOffice compila con Turbopack, que no resuelve los
 * imports ESM con extensión `.js` que usa `@repo/payments` en toda su cadena interna.
 * Clickatón lo evita compilando con webpack, pero FotoOffice no puede cambiar de bundler
 * sin romper otra parte de la app. Se comparten sí las piezas que no tienen imports
 * internos de valor —PKCE y el cliente OAuth—, que son las que definen el protocolo.
 *
 * Lo que se duplica acá son 30 líneas de AES-GCM estándar de `node:crypto`, no lógica de
 * negocio: si cambia, cambia porque cambió el algoritmo, no porque cambió una regla.
 */

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;

export function decodeMasterKey(masterKeyBase64: string): Buffer {
  const key = Buffer.from(masterKeyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("La clave maestra debe ser de 32 bytes en base64.");
  }
  return key;
}

export type EncryptedParts = { ciphertext: string; nonce: string; authTag: string };

export function encryptUtf8(plaintext: string, key: Buffer): EncryptedParts {
  const nonce = createHash("sha256")
    .update(`${Date.now()}:${Math.random()}:${plaintext.length}`)
    .digest()
    .subarray(0, NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptUtf8(parts: EncryptedParts, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(parts.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(parts.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Cifra el verificador PKCE con la clave maestra de la bóveda. */
export function encryptPkceVerifier(verifier: string, masterKeyBase64: string): EncryptedParts {
  return encryptUtf8(verifier, decodeMasterKey(masterKeyBase64));
}

/** Descifra el verificador PKCE. Lanza si el texto fue alterado (GCM verifica integridad). */
export function decryptPkceVerifier(parts: EncryptedParts, masterKeyBase64: string): string {
  return decryptUtf8(parts, decodeMasterKey(masterKeyBase64));
}
