import type { AndreaniError } from "./errors";

/**
 * El texto que ve la institución cuando Andreani falla, según el `kind`. Módulo PURO.
 *
 * Sólo `BUSINESS` repite el texto de Andreani (suele decir qué dato está mal, ej. "No se pudo
 * obtener la tarifa"); el resto tiene un texto fijo. Esto es para la PANTALLA: a los logs va
 * sólo `kind` y `status`, nunca el mensaje.
 */
export function andreaniUserMessage(error: Pick<AndreaniError, "kind" | "message">): string {
  switch (error.kind) {
    case "AUTH":
      return "Andreani no aceptó el usuario o la contraseña. Revisalos y volvé a conectar.";
    case "BUSINESS": {
      const detalle = error.message.trim();
      return detalle
        ? `Andreani rechazó el pedido: ${detalle}`
        : "Andreani rechazó el pedido. Revisá el código de cliente, los contratos y el código postal.";
    }
    case "RATE_LIMIT":
      return "Andreani recibió demasiados pedidos seguidos. Probá de nuevo en unos minutos.";
    case "NETWORK":
      return "No pudimos comunicarnos con Andreani. Probá de nuevo en un rato.";
    default:
      return "Andreani contestó algo que no esperábamos. Probá de nuevo en un rato.";
  }
}

/** "300006611" → "•••••6611". Contratos y código de cliente: sólo los últimos 4. */
export function maskAndreaniCode(code: string): string {
  const limpio = code.trim();
  if (limpio.length <= 4) return "•".repeat(limpio.length);
  return `${"•".repeat(Math.min(limpio.length - 4, 6))}${limpio.slice(-4)}`;
}

/** "usuario-api" → "us•••". El usuario de la API se reconoce por el comienzo. */
export function maskAndreaniUser(user: string): string {
  const limpio = user.trim();
  if (limpio.length <= 2) return "•".repeat(limpio.length);
  return `${limpio.slice(0, 2)}•••`;
}
