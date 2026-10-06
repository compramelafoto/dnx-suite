import "server-only";
import { requireServiceLeadsContext } from "@/lib/workspace";

/**
 * Pantallas de Captación (tablero, lista, informe, ficha de la consulta): la misma puerta que
 * main usa para la bandeja de pedidos, `requireServiceLeadsContext` — módulo encendido y nivel
 * "Ver" en Captación (`service-leads`). Mover, ganar o perder una consulta lo decide cada acción
 * del motor de etapas con `operar` (nivel "Gestionar") sobre el mismo módulo.
 */
export async function requireServiceLeadsStaff() {
  return requireServiceLeadsContext("VIEW");
}
