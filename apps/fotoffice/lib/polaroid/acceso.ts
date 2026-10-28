import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { POLAROID_MODULE_KEY } from "./constantes";

/** Quién diseña polaroids: quien gestiona Polaroid, o quien gestiona Ventas (las cobra). */
export async function canDesignPolaroids(userId: number, workspaceId: string): Promise<boolean> {
  return (
    (await hasModuleLevel(userId, workspaceId, POLAROID_MODULE_KEY, "MANAGE")) ||
    (await hasModuleLevel(userId, workspaceId, SALES_MODULE_KEY, "MANAGE"))
  );
}

/**
 * La pantalla de Polaroid: el módulo encendido y permiso para diseñar. `puedeCobrar` decide si
 * se ofrece llevar lo diseñado al Mostrador, que pide gestionar Ventas.
 */
export async function requirePolaroid() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const [modulo, puede, puedeCobrar] = await Promise.all([
    isModuleEnabledForWorkspace(workspace.id, POLAROID_MODULE_KEY),
    canDesignPolaroids(user.id, workspace.id),
    hasModuleLevel(user.id, workspace.id, SALES_MODULE_KEY, "MANAGE"),
  ]);
  if (!modulo || !puede) redirect("/dashboard");
  return { user, workspace, puedeCobrar };
}
