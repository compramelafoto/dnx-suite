import { decodeMasterKey, decryptUtf8, encryptUtf8 } from "@repo/payments/credential-vault";

/**
 * El token de Mercado Pago del vendedor, cifrado.
 *
 * Con ese token se puede cobrar en nombre del vendedor, así que no va en texto
 * plano en la base. Se usa el cifrado del vault de `@repo/payments`, que ya está
 * escrito y probado: AES-GCM, que además de ocultar **detecta si alguien tocó
 * el texto cifrado** en lugar de devolver basura.
 *
 * La clave maestra vive en `MP_CREDENTIAL_KEY`, 32 bytes en base64.
 */

export type CredencialGuardada = {
  ciphertext: string;
  nonce: string;
  authTag: string;
  version: 1;
};

export type Credencial = {
  accessToken: string;
  refreshToken: string | null;
};

export function cifrarCredencial(credencial: Credencial, claveBase64: string): CredencialGuardada {
  const partes = encryptUtf8(JSON.stringify(credencial), decodeMasterKey(claveBase64));
  return { ...partes, version: 1 };
}

export function descifrarCredencial(
  guardada: CredencialGuardada,
  claveBase64: string,
): Credencial {
  return JSON.parse(descifrarTexto(guardada, claveBase64)) as Credencial;
}

function descifrarTexto(guardada: CredencialGuardada, claveBase64: string): string {
  return decryptUtf8(guardada, decodeMasterKey(claveBase64));
}

/** Verifica que lo que vino de la base tenga la forma esperada antes de descifrarlo. */
export function esCredencial(valor: unknown): valor is CredencialGuardada {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.ciphertext === "string" &&
    typeof v.nonce === "string" &&
    typeof v.authTag === "string" &&
    v.version === 1
  );
}

/** La clave maestra, o un error claro si falta. */
export function claveDeCifrado(): string {
  const clave = process.env.MP_CREDENTIAL_KEY?.trim();
  if (!clave) throw new Error("Falta MP_CREDENTIAL_KEY.");
  return clave;
}
