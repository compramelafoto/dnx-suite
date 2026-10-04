import { randomBytes } from "node:crypto";

/**
 * Alfabeto del código de regalo: 31 caracteres sin 0/O/1/I/L, para que nadie
 * se equivoque al leerlo de una pantalla y tipearlo en otra.
 */
export const GIFT_VOUCHER_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Lo que la gente tipea cuando confunde un carácter. El mapeo es arbitrario
 * pero fijo: como el alfabeto no contiene estos caracteres, ningún código
 * real puede verse afectado por la corrección.
 */
const AMBIGUOUS_FIXES: Record<string, string> = {
  "0": "Q",
  O: "Q",
  "1": "J",
  I: "J",
  L: "J",
};

const PREFIX = "REGALO";
const BODY_LENGTH = 8;

/**
 * Mayor múltiplo del alfabeto que entra en un byte. Los bytes por encima de
 * este umbral se descartan: tomar el módulo sin filtrar le daría más
 * probabilidad a los primeros caracteres del alfabeto.
 */
const UNBIASED_CEILING =
  Math.floor(256 / GIFT_VOUCHER_CODE_ALPHABET.length) * GIFT_VOUCHER_CODE_ALPHABET.length;

/** REGALO-XXXX-XXXX con ~40 bits de entropía. */
export function generateGiftVoucherCode(
  random: (size: number) => Uint8Array = randomBytes,
): string {
  let body = "";
  while (body.length < BODY_LENGTH) {
    for (const byte of random(BODY_LENGTH * 2)) {
      if (byte >= UNBIASED_CEILING) continue;
      body += GIFT_VOUCHER_CODE_ALPHABET[byte % GIFT_VOUCHER_CODE_ALPHABET.length];
      if (body.length === BODY_LENGTH) break;
    }
  }
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Acepta lo que la gente pega: con o sin prefijo, con o sin guiones, en
 * minúscula, con espacios y con caracteres ambiguos.
 * Devuelve el código canónico, o null si no es uno.
 */
export function normalizeGiftVoucherCode(raw: string): string | null {
  const upper = (raw ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (!upper) return null;
  const withoutPrefix = upper.startsWith(PREFIX) ? upper.slice(PREFIX.length) : upper;
  if (withoutPrefix.length !== BODY_LENGTH) return null;

  let body = "";
  for (const char of withoutPrefix) {
    const fixed = AMBIGUOUS_FIXES[char] ?? char;
    if (!GIFT_VOUCHER_CODE_ALPHABET.includes(fixed)) return null;
    body += fixed;
  }
  return `${PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`;
}
