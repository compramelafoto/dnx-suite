import type { MiCorreoError } from "./errors";

/**
 * El texto que ve la institución cuando MiCorreo falla, según el `kind`. Módulo PURO.
 *
 * Sólo `BUSINESS` repite el texto de Correo (suele decir qué dato está mal, ej. "Usuario no
 * valido o inexistente"); el resto de los casos tiene un texto fijo. Esto es para la PANTALLA:
 * a los logs va sólo `kind` y `status`, nunca el mensaje.
 */
export function miCorreoUserMessage(error: Pick<MiCorreoError, "kind" | "message">): string {
  switch (error.kind) {
    case "AUTH":
      return "Correo Argentino no aceptó el usuario o la contraseña de la API. Revisalos y volvé a conectar.";
    case "BUSINESS": {
      const detalle = error.message.trim();
      return detalle
        ? `Correo Argentino rechazó el pedido: ${detalle}`
        : "Correo Argentino rechazó el pedido. Revisá los datos.";
    }
    case "RATE_LIMIT":
      return "Correo Argentino recibió demasiados pedidos seguidos. Probá de nuevo en unos minutos.";
    case "NETWORK":
      return "No pudimos comunicarnos con Correo Argentino. Probá de nuevo en un rato.";
    default:
      return "Correo Argentino contestó algo que no esperábamos. Probá de nuevo en un rato.";
  }
}

/** "123456789" → "•••••6789". Para mostrar el número de cliente sin exponerlo entero. */
export function maskCustomerId(customerId: string): string {
  const limpio = customerId.trim();
  if (limpio.length <= 4) return "•".repeat(limpio.length);
  return `${"•".repeat(Math.min(limpio.length - 4, 6))}${limpio.slice(-4)}`;
}
