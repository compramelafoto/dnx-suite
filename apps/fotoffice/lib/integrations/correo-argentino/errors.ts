/**
 * Errores del cliente de MiCorreo, con un `kind` que dice QUÉ HACER, no qué pasó por dentro:
 *
 * - `AUTH`: las credenciales ya no sirven (401, después del único reintento). Hace falta que una persona reconecte.
 * - `BUSINESS`: Correo entendió el pedido y lo rechazó (400/402/403/404/409 con `{code, message}`;
 *   un 403 también puede ser un firewall: no pide reconectar);
 *   `message` trae el texto de Correo, que suele ser útil ("Usuario no valido o inexistente").
 * - `RATE_LIMIT`: 429. Reintentar más tarde.
 * - `NETWORK`: no hubo respuesta (fetch rechazado o pasaron los 5 s).
 * - `UNEXPECTED`: cualquier otra cosa (50x, cuerpo que no se entiende, precio inválido).
 *
 * Regla: el mensaje NUNCA incluye credenciales (usuario/clave de la API, contraseña de la
 * cuenta ni el token). Se arma acá adentro con datos fijos más, a lo sumo, el texto que
 * devolvió Correo.
 */

export type MiCorreoErrorKind = "AUTH" | "BUSINESS" | "RATE_LIMIT" | "NETWORK" | "UNEXPECTED";

/**
 * Para loguear: sólo `kind` y `status`, NUNCA `message`. El mensaje puede repetir texto de
 * Correo con datos de la cuenta (customerId, email); sirve para mostrárselo a la institución,
 * no para los logs.
 */
export class MiCorreoError extends Error {
  readonly kind: MiCorreoErrorKind;
  /** Código HTTP de la respuesta, si la hubo. */
  readonly status: number | null;

  constructor(kind: MiCorreoErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "MiCorreoError";
    this.kind = kind;
    this.status = status;
  }
}

export function isMiCorreoError(error: unknown): error is MiCorreoError {
  return error instanceof MiCorreoError;
}
