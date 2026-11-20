/**
 * Detalles chicos que comparten la parte de base y la página pública. Módulo PURO.
 */

/** Forma del token del enlace: 32 caracteres base64url (24 bytes al azar). */
export const TOKEN_VALIDO = /^[A-Za-z0-9_-]{32}$/;

export function esTokenValido(token: unknown): token is string {
  return typeof token === "string" && TOKEN_VALIDO.test(token);
}

/**
 * Las tablas de cuestionarios se crean a mano. Mientras no existan, Prisma tira P2021 (tabla) o
 * P2022 (columna) y la pantalla tiene que mostrar vacío en vez de romperse.
 */
export function esTablaFaltante(err: unknown): boolean {
  const code = typeof err === "object" && err !== null ? (err as { code?: unknown }).code : undefined;
  return code === "P2021" || code === "P2022";
}

/** La dirección pública del enlace que se le manda al cliente. */
export function rutaPublica(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, "")}/cuestionario/${token}`;
}
