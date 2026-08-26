import type { ParticipantStatusTone } from "../participant-experience/status-labels";
import type { StatusTone } from "./participant-status";

/**
 * Puente entre los dos vocabularios de tono que conviven en la app.
 *
 * `ParticipantStatusTone` (dominio participante) tiene seis valores;
 * `StatusTone` (StatusBadge de public-ui) tiene cinco. Comparten cuatro
 * —neutral, success, warning, danger— y difieren en dos:
 *
 *   info   → primary   destaca sin implicar éxito (p. ej. "En proceso")
 *   locked → neutral   estado inmovilizado: no es advertencia ni error
 *
 * Existe como función y no como mapeo suelto en cada página porque el
 * desajuste no se detecta en runtime: si alguien vuelve a pasar el tono del
 * dominio directo al badge, TypeScript falla, y la salida fácil es castear.
 * Casteando, `info` y `locked` llegarían al badge como clases inexistentes y
 * el estado se mostraría sin color, en silencio.
 */
export function toStatusBadgeTone(tone: ParticipantStatusTone): StatusTone {
  switch (tone) {
    case "info":
      return "primary";
    case "locked":
      return "neutral";
    case "neutral":
    case "success":
    case "warning":
    case "danger":
      return tone;
  }
}
