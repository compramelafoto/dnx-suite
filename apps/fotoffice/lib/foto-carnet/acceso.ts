import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { FOTO_CARNET_MODULE_KEY } from "./constantes";

/**
 * Quién prepara fotos carnet: quien gestiona Foto carnet, o quien gestiona Ventas, que las
 * cobra en el mostrador. Lo usan la pantalla suelta y las acciones de impresión que comparten
 * las dos (`app/(shell)/ventas/impresion/actions.ts`).
 */
export async function canPrepareFotoCarnet(userId: number, workspaceId: string): Promise<boolean> {
  return (
    (await hasModuleLevel(userId, workspaceId, FOTO_CARNET_MODULE_KEY, "MANAGE")) ||
    (await hasModuleLevel(userId, workspaceId, SALES_MODULE_KEY, "MANAGE"))
  );
}

/** La pantalla de Foto carnet: el módulo encendido y permiso para preparar. */
export async function requireFotoCarnet() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [modulo, puede] = await Promise.all([
    isModuleEnabledForWorkspace(workspace.id, FOTO_CARNET_MODULE_KEY),
    canPrepareFotoCarnet(user.id, workspace.id),
  ]);
  if (!modulo || !puede) redirect("/dashboard");
  return { user, workspace };
}
