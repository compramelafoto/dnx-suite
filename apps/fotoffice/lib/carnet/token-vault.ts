import "server-only";
import { decodeMasterKey, decryptUtf8, encryptUtf8 } from "@repo/payments/credential-vault";

/**
 * Guarda y recupera el token del QR.
 *
 * Usa la **misma clave maestra** que la bóveda de credenciales
 * (`DNX_FINANCIAL_CREDENTIAL_MASTER_KEY`), a propósito: dos claves distintas serían dos cosas
 * que rotar y dos formas de perder acceso a lo cifrado.
 */

export type SealedToken = { ciphertext: string; nonce: string; authTag: string };

function masterKey(): Buffer {
  const raw = process.env.DNX_FINANCIAL_CREDENTIAL_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error("DNX_FINANCIAL_CREDENTIAL_MASTER_KEY no está configurada.");
  }
  return decodeMasterKey(raw);
}

export function sealCardToken(token: string): SealedToken {
  return encryptUtf8(token, masterKey());
}

/**
 * Devuelve el token o `null` si no se puede descifrar.
 *
 * `null` en vez de excepción: un carnet cuyo token no se puede leer sigue siendo válido para
 * quien lo escanea —la verificación va por el hash—, así que lo único que se pierde es
 * mostrarle el QR al socio. Voltear la pantalla entera por eso sería desproporcionado.
 */
export function openCardToken(sealed: Partial<SealedToken> | null): string | null {
  if (!sealed?.ciphertext || !sealed.nonce || !sealed.authTag) return null;
  try {
    return decryptUtf8(
      { ciphertext: sealed.ciphertext, nonce: sealed.nonce, authTag: sealed.authTag },
      masterKey(),
    );
  } catch {
    return null;
  }
}
