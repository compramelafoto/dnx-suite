/**
 * Errores del cliente de Andreani, con un `kind` que dice QUÉ HACER, no qué pasó por dentro
 * (mismo diseño que `../correo-argentino/errors.ts`):
 *
 * - `AUTH`: las credenciales ya no sirven (401, después del único reintento con un token
 *   nuevo). Hace falta que una persona reconecte.
 * - `BUSINESS`: Andreani entendió el pedido y lo rechazó (400/402/403/404/409). Suele venir en
 *   formato ProblemDetails (`{ type, title, detail, status, errors }`); `message` conserva
 *   `detail`/`title` porque le sirve a la institución ("No se pudo obtener la tarifa").
 *   Un 403 puede ser el firewall (Cloudflare): no pide reconectar.
 * - `RATE_LIMIT`: 429. Reintentar más tarde.
 * - `NETWORK`: no hubo respuesta (fetch rechazado o pasaron los 5 s).
 * - `UNEXPECTED`: cualquier otra cosa (50x, cuerpo que no se entiende, precio inválido).
 *
 * Regla: el mensaje NUNCA incluye credenciales (usuario, contraseña ni token). Se arma acá
 * adentro con datos fijos más, a lo sumo, el texto que devolvió Andreani.
 */

export type AndreaniErrorKind = "AUTH" | "BUSINESS" | "RATE_LIMIT" | "NETWORK" | "UNEXPECTED";

/**
 * Para loguear: sólo `kind` y `status`, NUNCA `message`. El mensaje puede repetir texto de
 * Andreani con datos de la cuenta (contrato, cliente); sirve para mostrárselo a la
 * institución, no para los logs.
 */
export class AndreaniError extends Error {
  readonly kind: AndreaniErrorKind;
  /** Código HTTP de la respuesta, si la hubo. */
  readonly status: number | null;

  constructor(kind: AndreaniErrorKind, message: string, status: number | null = null) {
    super(message);
    this.name = "AndreaniError";
    this.kind = kind;
    this.status = status;
  }
}

export function isAndreaniError(error: unknown): error is AndreaniError {
  return error instanceof AndreaniError;
}
