import { escaparHtml } from "../periodista/mensaje";

/**
 * Mensajes del Vendedor a Daniel por Telegram (HTML de Telegram). Módulo puro.
 */

/** Aviso de que el Vendedor se pausó solo: por la salud de la dirección o por el tope de Claude. */
export function mensajePausa(motivo: "SALUD" | "TOPE", detalle: string): string {
  const d = escaparHtml(detalle);
  if (motivo === "SALUD") {
    return [
      "⏸️ Pausé el Vendedor: la dirección de envío está en riesgo.",
      d,
      "Revisá los rebotes y las quejas antes de reanudarlo desde el panel.",
    ].join("\n\n");
  }
  return [
    "⏸️ Pausé el Vendedor: llegó al tope de gasto de Claude del mes.",
    d,
    "Vuelve a andar el mes que viene, o antes si subís el tope desde el panel.",
  ].join("\n\n");
}
