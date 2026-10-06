import "server-only";
import { getModuleLevels } from "@/lib/permissions/module-access";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import type { AccesoEfectivo } from "./policy";

/**
 * El acceso efectivo de alguien en un workspace, con el modelo de main (`getModuleLevels`).
 * Se resuelve una vez por pedido: `getModuleLevels` comparte con el menú y las guardas la misma
 * consulta (cache de React por usuario y workspace).
 */
export async function resolverAcceso(userId: number, workspaceId: string): Promise<AccesoEfectivo> {
  const [role, levels] = await Promise.all([
    resolveWorkspaceRole(userId, workspaceId),
    getModuleLevels(userId, workspaceId),
  ]);
  return { role, levels };
}
