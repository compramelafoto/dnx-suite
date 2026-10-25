import "server-only";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

/**
 * Quién diseña los fotolibros del estudio: quien gestiona Ventas, que es quien los vende y los
 * manda al laboratorio. Con este permiso sólo se abren fotolibros; el carnet y las piezas de la
 * institución siguen pidiendo gestionar Socios. Ver `lib/template-v2/server.ts`.
 */
export async function canDesignFotolibros(userId: number, workspaceId: string): Promise<boolean> {
  return hasModuleLevel(userId, workspaceId, SALES_MODULE_KEY, "MANAGE");
}
