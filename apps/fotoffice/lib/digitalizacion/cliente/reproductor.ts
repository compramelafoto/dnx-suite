/**
 * Decisiones del reproductor de la versión para mirar (spec 2026-10-22, E10), separadas del
 * componente para poder probarlas sin navegador.
 */

export type ModoReproduccion = "NATIVO" | "HLSJS" | "NINGUNO";

/**
 * hls.js primero, siempre que haya Media Source (Chrome, Firefox, Edge, Safari y iPhone con iOS 17
 * o más). El HLS nativo queda para los navegadores sin Media Source (iPhone viejos): Chrome 14x
 * contesta "maybe" a `canPlayType` de HLS pero su reproductor propio no pudo con nuestra playlist
 * de segmentos firmados en R2 (22/10/2026), así que "maybe" ya no alcanza para preferirlo.
 */
export function modoDeReproduccion(puedeNativo: string, hlsJsSoportado: boolean): ModoReproduccion {
  if (hlsJsSoportado) return "HLSJS";
  if (puedeNativo === "probably" || puedeNativo === "maybe") return "NATIVO";
  return "NINGUNO";
}

/** Reintentos ante un error fatal de red (p. ej. firmas vencidas tras horas de pausa). */
export const REINTENTOS_RED = 2;

/** Qué hacer ante un error FATAL de hls.js. */
export function accionAnteError(tipo: string, reintentosRed: number, recuperacionesMedia: number): "RECARGAR" | "RECUPERAR_MEDIA" | "RENDIRSE" {
  if (tipo === "networkError") return reintentosRed < REINTENTOS_RED ? "RECARGAR" : "RENDIRSE";
  if (tipo === "mediaError") return recuperacionesMedia < 1 ? "RECUPERAR_MEDIA" : "RENDIRSE";
  return "RENDIRSE";
}

/** El texto para quien mira, según la respuesta de la ruta de la playlist. */
export function mensajeDeEstado(estado: number | null): string {
  if (estado === 402) return "Para mirar el video primero hay que pagar el saldo del pedido.";
  if (estado === 410) return "Este video ya no está disponible.";
  if (estado === 404) return "La versión para mirar todavía se está preparando. Probá de nuevo en un rato.";
  if (estado === 429) return "Hubo demasiados pedidos desde tu conexión. Esperá unos minutos.";
  return "No se pudo reproducir el video. Recargá la página y probá de nuevo.";
}
