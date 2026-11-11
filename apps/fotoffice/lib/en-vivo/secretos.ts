import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  requireIntegrationsMasterKey,
  type EncryptedBlob,
} from "@/lib/integrations/vault";
import { terminacion } from "./destinos";

/**
 * Las claves de destino que se recuerdan (YouTube siempre, TikTok si se pide), cifradas con el
 * baúl de integraciones (`lib/integrations/vault.ts`, AES-256-GCM, `DNX_INTEGRATIONS_VAULT_MASTER_KEY`).
 *
 * Se guardan en cuatro columnas por clave más la terminación en claro. Descifrar sólo pasa en el
 * servidor, en el momento de crear el output en Cloudflare.
 */

export type ColumnasClave = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
  last4: string;
};

export function cifrarClave(clave: string, env: NodeJS.ProcessEnv = process.env): ColumnasClave {
  const blob = encryptIntegrationSecret(clave.trim(), requireIntegrationsMasterKey(env));
  return { ...blob, last4: terminacion(clave) };
}

/** `null` si no hay nada guardado. Lanza si la clave maestra cambió o el dato se alteró. */
export function descifrarClave(
  cols: { ciphertext: string | null; nonce: string | null; authTag: string | null; keyVersion: string | null },
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!cols.ciphertext || !cols.nonce || !cols.authTag || !cols.keyVersion) return null;
  const blob: EncryptedBlob = {
    ciphertext: cols.ciphertext,
    nonce: cols.nonce,
    authTag: cols.authTag,
    keyVersion: cols.keyVersion,
  };
  return decryptIntegrationSecret(blob, requireIntegrationsMasterKey(env));
}

/** Columnas del canal para YouTube, listas para `prisma.update`. */
export function columnasYoutube(c: ColumnasClave | null) {
  return {
    youtubeKeyCiphertext: c?.ciphertext ?? null,
    youtubeKeyNonce: c?.nonce ?? null,
    youtubeKeyAuthTag: c?.authTag ?? null,
    youtubeKeyVersion: c?.keyVersion ?? null,
    youtubeKeyLast4: c?.last4 ?? null,
  };
}

export function columnasTiktok(c: ColumnasClave | null) {
  return {
    tiktokKeyCiphertext: c?.ciphertext ?? null,
    tiktokKeyNonce: c?.nonce ?? null,
    tiktokKeyAuthTag: c?.authTag ?? null,
    tiktokKeyVersion: c?.keyVersion ?? null,
    tiktokKeyLast4: c?.last4 ?? null,
  };
}
