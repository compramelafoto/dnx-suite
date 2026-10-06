/**
 * Decisiones puras del envío de a tandas: qué hacer con una tanda que falló y cómo cerrar un envío.
 */

/**
 * Un rechazo 4xx (salvo 429, demasiadas llamadas) no se arregla reintentando: la dirección o el
 * contenido están mal. Todo lo demás —caída de red, 429, 5xx, falta de configuración— se reintenta
 * en la próxima pasada de la tarea programada.
 */
export function isPermanentFailure(status: string, detail: string): boolean {
  if (status !== "PROVIDER_REJECTED") return false;
  const m = detail.match(/HTTP (\d{3})/);
  if (!m) return false;
  const code = Number(m[1]);
  return code >= 400 && code < 500 && code !== 429;
}

export type DeliveryCounts = { pending: number; sending: number; sent: number; failed: number };

export function campaignStatusFor(c: DeliveryCounts): "SENDING" | "SENT" | "FAILED" {
  if (c.pending > 0 || c.sending > 0) return "SENDING";
  if (c.sent === 0 && c.failed > 0) return "FAILED";
  return c.failed > 0 ? "FAILED" : "SENT";
}
