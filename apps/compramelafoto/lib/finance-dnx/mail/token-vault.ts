import { decodeMasterKey, decryptUtf8, encryptUtf8 } from "@repo/payments/credential-vault";

export function vaultKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  const key = env.FINANCE_MAIL_VAULT_KEY?.trim();
  if (!key) throw new Error("Falta la variable FINANCE_MAIL_VAULT_KEY (32 bytes en base64).");
  return key;
}

export function sealRefreshToken(token: string, keyBase64: string): string {
  return JSON.stringify(encryptUtf8(token, decodeMasterKey(keyBase64)));
}

export function openRefreshToken(sealed: string, keyBase64: string): string {
  const parts = JSON.parse(sealed) as { ciphertext: string; nonce: string; authTag: string };
  return decryptUtf8(parts, decodeMasterKey(keyBase64));
}
