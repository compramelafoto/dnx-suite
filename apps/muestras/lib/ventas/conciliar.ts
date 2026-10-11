import "server-only";
import type { OrdenLeida } from "./mp";

/**
 * Conciliación de pedidos con Mercado Pago (etapa 8, D29, D30). La implementación completa llega con
 * la tarea 12; por ahora no cambia nada.
 */
export type OrigenDeConciliacion = "CREATE" | "RETURN" | "NOTICE" | "SWEEP" | "ADMIN";

export type ResultadoDeConciliacion = { estado: string; cambio: boolean } | null;

export async function conciliarDesdeOrden(orden: OrdenLeida, origen: OrigenDeConciliacion): Promise<ResultadoDeConciliacion> {
  void orden;
  void origen;
  return null;
}
