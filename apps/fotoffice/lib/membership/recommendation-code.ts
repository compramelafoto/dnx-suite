/**
 * El código del enlace de recomendación de un socio.
 *
 * Módulo PURO: recibe la fuente de azar por parámetro para que el resultado se pueda
 * verificar sin depender de `crypto`.
 *
 * El código es **opaco a propósito**. Podría ser el número de socio —más corto y más fácil
 * de dictar—, pero entonces cualquiera podría probar números y atribuirse altas ajenas, o
 * deducir cuántos socios tiene la institución. Un código sin relación con el padrón no
 * revela nada y no se adivina.
 */

/**
 * Sin `0`, `O`, `1`, `I` ni `L`: el enlace se dicta por teléfono y se copia a mano, y esos
 * cinco caracteres son los que se confunden.
 */
export const RECOMMENDATION_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Diez caracteres sobre 31 símbolos: más de 8×10^14 combinaciones. Suficiente y corto. */
export const RECOMMENDATION_CODE_LENGTH = 10;

export function generateRecommendationCode(randomBytes: (n: number) => Uint8Array): string {
  const alfabeto = RECOMMENDATION_CODE_ALPHABET;
  const bytes = randomBytes(RECOMMENDATION_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < RECOMMENDATION_CODE_LENGTH; i++) {
    code += alfabeto[(bytes[i] ?? 0) % alfabeto.length];
  }
  return code;
}

/**
 * Normaliza lo que llega por la URL o pegado en un campo.
 *
 * Devuelve `null` ante cualquier cosa que no tenga forma de código. Quien lo use debe tratar
 * ese `null` como «no vino ninguna recomendación», nunca como un error de la persona: un
 * enlace mal copiado no puede impedirle asociarse.
 */
export function normalizeRecommendationCode(raw: string | null | undefined): string | null {
  const limpio = (raw ?? "").trim().toUpperCase();
  if (limpio.length !== RECOMMENDATION_CODE_LENGTH) return null;
  for (const ch of limpio) {
    if (!RECOMMENDATION_CODE_ALPHABET.includes(ch)) return null;
  }
  return limpio;
}
