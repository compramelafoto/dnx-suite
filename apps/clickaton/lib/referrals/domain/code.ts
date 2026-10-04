import { randomBytes } from "node:crypto";

/**
 * Código del link de invitación: `CK-XXXXX`.
 *
 * Va en una URL, así que es corto. Igual usa el alfabeto sin caracteres
 * ambiguos del módulo de regalos, porque la gente lo dicta por teléfono y lo
 * lee de una pantalla ajena.
 *
 * ~24 bits de entropía. Suficiente: el código no da acceso a nada, sólo
 * atribuye una visita, y adivinarlo únicamente le regala un referido a un
 * desconocido.
 */

export const REFERRAL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Lo que la gente tipea cuando confunde un carácter. */
const AMBIGUOUS_FIXES: Record<string, string> = {
  "0": "Q",
  O: "Q",
  "1": "J",
  I: "J",
  L: "J",
};

const PREFIX = "CK";
const BODY_LENGTH = 5;

/**
 * Mayor múltiplo del alfabeto que entra en un byte. Los bytes por encima se
 * descartan: tomar el módulo sin filtrar le daría más probabilidad a los
 * primeros caracteres.
 */
const UNBIASED_CEILING =
  Math.floor(256 / REFERRAL_CODE_ALPHABET.length) * REFERRAL_CODE_ALPHABET.length;

export function generateReferralCode(
  random: (size: number) => Uint8Array = randomBytes,
): string {
  let body = "";
  while (body.length < BODY_LENGTH) {
    for (const byte of random(BODY_LENGTH * 2)) {
      if (byte >= UNBIASED_CEILING) continue;
      body += REFERRAL_CODE_ALPHABET[byte % REFERRAL_CODE_ALPHABET.length];
      if (body.length === BODY_LENGTH) break;
    }
  }
  return `${PREFIX}-${body}`;
}

/**
 * Acepta lo que la gente pega: con o sin prefijo, con o sin guión, en
 * minúscula, con espacios y con caracteres ambiguos.
 * Devuelve el código canónico, o null si no es uno.
 */
export function normalizeReferralCode(raw: string): string | null {
  const upper = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!upper) return null;
  const withoutPrefix = upper.startsWith(PREFIX) ? upper.slice(PREFIX.length) : upper;
  if (withoutPrefix.length !== BODY_LENGTH) return null;

  let body = "";
  for (const char of withoutPrefix) {
    const fixed = AMBIGUOUS_FIXES[char] ?? char;
    if (!REFERRAL_CODE_ALPHABET.includes(fixed)) return null;
    body += fixed;
  }
  return `${PREFIX}-${body}`;
}
