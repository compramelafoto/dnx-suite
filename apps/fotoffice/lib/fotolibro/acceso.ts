import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { FOTOLIBROS_MODULE_KEY } from "./constantes";

/**
 * Quién diseña los fotolibros del estudio: quien gestiona Fotolibros, o quien gestiona Ventas,
 * que los vende en el mostrador y los manda al laboratorio. Con este permiso sólo se abren
 * fotolibros; el carnet y las piezas de la institución siguen pidiendo gestionar Socios. Ver
 * `lib/template-v2/server.ts`.
 */
export async function canDesignFotolibros(userId: number, workspaceId: string): Promise<boolean> {
  return (
    (await hasModuleLevel(userId, workspaceId, FOTOLIBROS_MODULE_KEY, "MANAGE")) ||
    (await hasModuleLevel(userId, workspaceId, SALES_MODULE_KEY, "MANAGE"))
  );
}

/**
 * La pantalla de Fotolibros: el módulo tiene que estar encendido y la persona tiene que poder
 * diseñarlos. Gestionar Ventas alcanza para el fotolibro del Cobrador, no para abrir el módulo.
 */
export async function requireFotolibros() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [modulo, puede] = await Promise.all([
    isModuleEnabledForWorkspace(workspace.id, FOTOLIBROS_MODULE_KEY),
    canDesignFotolibros(user.id, workspace.id),
  ]);
  if (!modulo || !puede) redirect("/dashboard");
  return { user, workspace };
}
