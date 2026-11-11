/**
 * El recorrido de un vivo, como función pura.
 *
 * Lo mueven tres fuentes que pueden llegar en cualquier orden y repetidas: los avisos de
 * Cloudflare (señal conectada, cortada, grabación lista), lo que contesta Cloudflare cuando el
 * panel pregunta, y el botón «Terminar». Por eso cada transición es idempotente: aplicar dos
 * veces el mismo evento deja el mismo estado.
 */

export type EstadoVivo = "ESPERANDO_SENAL" | "EN_VIVO" | "SENAL_CORTADA" | "TERMINADA" | "CANCELADA";

export type EventoVivo =
  /** OBS empezó a mandar (o volvió). */
  | "SENAL_CONECTADA"
  /** OBS dejó de mandar. Puede volver. */
  | "SENAL_CORTADA"
  /** Cloudflare cerró la grabación: si no había señal, el vivo terminó. */
  | "GRABACION_LISTA"
  /** La persona apretó «Terminar vivo». */
  | "TERMINAR";

export const ESTADOS_ACTIVOS: readonly EstadoVivo[] = ["ESPERANDO_SENAL", "EN_VIVO", "SENAL_CORTADA"];

export function estaActivo(estado: EstadoVivo): boolean {
  return ESTADOS_ACTIVOS.includes(estado);
}

/** Si hay imagen para mirar: el reproductor sólo se muestra en estos estados. */
export function seEstaTransmitiendo(estado: EstadoVivo): boolean {
  return estado === "EN_VIVO" || estado === "SENAL_CORTADA";
}

export function transicion(estado: EstadoVivo, evento: EventoVivo): EstadoVivo {
  // Lo terminado no revive: un aviso viejo que llega tarde no reabre un vivo.
  if (!estaActivo(estado)) return estado;
  switch (evento) {
    case "SENAL_CONECTADA":
      return "EN_VIVO";
    case "SENAL_CORTADA":
      return estado === "EN_VIVO" ? "SENAL_CORTADA" : estado;
    case "GRABACION_LISTA":
      // Con señal, la grabación lista es de un tramo anterior: el vivo sigue.
      return estado === "SENAL_CORTADA" ? "TERMINADA" : estado;
    case "TERMINAR":
      return estado === "ESPERANDO_SENAL" ? "CANCELADA" : "TERMINADA";
  }
}

/**
 * Lo que contesta Cloudflare en `status` de un live input, traducido a «hay señal o no».
 * `null` = no se sabe (sin dato o un estado nuevo): no se cambia nada.
 */
export function senalSegunCloudflare(status: unknown): boolean | null {
  switch (status) {
    case "connected":
    case "reconnected":
      return true;
    case "reconnecting":
    case "client_disconnect":
    case "ttl_exceeded":
    case "failed_to_connect":
    case "failed_to_reconnect":
      return false;
    default:
      return null;
  }
}

export const ETIQUETA_ESTADO: Record<EstadoVivo, string> = {
  ESPERANDO_SENAL: "Esperando la señal de OBS",
  EN_VIVO: "En vivo",
  SENAL_CORTADA: "Se cortó la señal",
  TERMINADA: "Terminado",
  CANCELADA: "Cancelado",
};
