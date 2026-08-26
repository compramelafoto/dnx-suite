import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * El token del QR — **solo servidor**.
 *
 * Sin `import "server-only"` y con `node:crypto` a la vista: es la misma convención que
 * `members/invitation-tokens.ts`, que se separó justamente para que este import no entrara
 * al bundle del navegador. No se importa desde un componente cliente.
 *
 * Es **aleatorio**: no es el número de socio, ni el de carnet, ni deriva de ellos. Tres
 * motivos, en orden de importancia:
 *
 * 1. Nadie lee datos personales del código. Un QR es texto plano para cualquiera con un
 *    teléfono.
 * 2. Se puede revocar. Un token invalidado deja de resolver; un número de socio no.
 * 3. Menos información es más legible. En 26 mm, un token corto da 0,70 mm por módulo y una
 *    URL con parámetros baja a 0,58.
 *
 * Se guarda **hasheado**, como una contraseña: quien tenga acceso a la base no puede
 * fabricar carnets válidos a partir de ella.
 */

/**
 * Alfabeto sin caracteres que se confundan al leerlos en voz alta o al transcribirlos:
 * fuera 0/O, 1/I/l. Un socio puede tener que dictar su enlace por teléfono.
 */
const ALFABETO = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * 16 caracteres de este alfabeto son 80 bits de azar. Alcanza de sobra contra la prueba y
 * error, y mantiene el QR en 29 módulos por lado con una URL corta.
 */
export const TOKEN_LENGTH = 16;

export function generateCardToken(): string {
  // Rechazo de sesgo: `randomBytes` da 0–255 y el alfabeto tiene 32 letras, que divide a 256
  // de forma exacta, así que el módulo no introduce sesgo. Se deja explícito para que el día
  // que alguien cambie el alfabeto vea por qué importa.
  if (256 % ALFABETO.length !== 0) {
    throw new Error("El alfabeto del token tiene que dividir a 256 para no sesgar el azar.");
  }
  const bytes = randomBytes(TOKEN_LENGTH);
  let salida = "";
  for (const b of bytes) {
    salida += ALFABETO[b % ALFABETO.length];
  }
  return salida;
}

export function hashCardToken(token: string): string {
  return createHash("sha256").update(token.trim().toUpperCase(), "utf8").digest("hex");
}

/**
 * Comparación en tiempo constante. Con hashes no hay secreto que filtrar por el tiempo, pero
 * el hábito es barato y el día que esto compare otra cosa ya está bien escrito.
 */
export function cardTokenMatches(token: string, storedHash: string): boolean {
  const calculado = Buffer.from(hashCardToken(token), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (calculado.length !== guardado.length) return false;
  return timingSafeEqual(calculado, guardado);
}

/** Un token que no tiene la forma correcta ni se busca en la base. */
export function looksLikeCardToken(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (v.length !== TOKEN_LENGTH) return false;
  for (const c of v) {
    if (!ALFABETO.includes(c)) return false;
  }
  return true;
}

/**
 * Número de carnet: `C-2026-0412`. Identifica **una emisión**, no a la persona.
 *
 * Es lo que permite invalidar un carnet perdido sin tocar la identidad del socio, que sigue
 * siendo el mismo número de socio de toda la vida.
 */
export function formatCardNumber(year: number, sequence: number): string {
  return `C-${year}-${String(sequence).padStart(4, "0")}`;
}
