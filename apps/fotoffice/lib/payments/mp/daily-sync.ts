import "server-only";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { searchMpPaymentsUpdatedBetween } from "./client";
import { syncMpPayment } from "./sync";
import { listConnectedWorkspaceIds } from "./workspaces";

/**
 * La revisión de todos los días: le pide a Mercado Pago los pagos de cada institución que
 * cambiaron en la ventana (aprobados, devueltos, desconocidos) y los pasa por el mismo camino
 * que los avisos. Encuentra lo que un aviso perdido no trajo, sobre todo las devoluciones, que
 * pueden llegar semanas después del cobro.
 *
 * La ventana es mucho más larga que el intervalo a propósito: una devolución o un contracargo
 * puede llegar semanas después del cobro y cambia la fecha de última actualización del pago,
 * y si una corrida falla la siguiente cubre esos días. Todo es idempotente, así que repasar un
 * pago ya aplicado no cambia nada. La primera corrida además completa las comisiones de los
 * cobros anteriores a este cambio (corrección de lo histórico del 2026-10-05).
 */

export const DAILY_SYNC_WINDOW_DAYS = 60;

export type DailySyncReport = {
  instituciones: number;
  pagos: number;
  porAccion: Record<string, number>;
  errores: number;
};

export async function runMpDailySync(opciones: { now?: Date; windowDays?: number } = {}): Promise<DailySyncReport> {
  const ahora = opciones.now ?? new Date();
  const desde = new Date(ahora.getTime() - (opciones.windowDays ?? DAILY_SYNC_WINDOW_DAYS) * 86_400_000);
  const reporte: DailySyncReport = { instituciones: 0, pagos: 0, porAccion: {}, errores: 0 };

  for (const workspaceId of await listConnectedWorkspaceIds()) {
    const collector = await resolveWorkspaceCollector(workspaceId);
    if (!collector.ok) continue;
    reporte.instituciones += 1;
    let pagos;
    try {
      pagos = await searchMpPaymentsUpdatedBetween(collector.collector.accessToken, { from: desde, to: ahora });
    } catch (error) {
      reporte.errores += 1;
      console.error("[fotoffice][mp-sync] no se pudo listar pagos", { workspaceId, detalle: sanitizeError(error) });
      continue;
    }
    for (const pago of pagos) {
      if (!pago.externalReference) continue;
      try {
        const r = await syncMpPayment(workspaceId, pago);
        if (r.module === "unknown") continue;
        reporte.pagos += 1;
        const clave = `${r.module}: ${r.action}`;
        reporte.porAccion[clave] = (reporte.porAccion[clave] ?? 0) + 1;
      } catch (error) {
        reporte.errores += 1;
        console.error("[fotoffice][mp-sync] falló un pago", {
          workspaceId,
          paymentId: pago.id,
          detalle: sanitizeError(error),
        });
      }
    }
  }
  return reporte;
}
