import "server-only";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { listModules } from "@/lib/modules/registry";
import { editableModuleKeys } from "./rules";

/**
 * Módulos que la grilla de permisos de un rol puede editar en este workspace, en el orden del
 * registro. Los planificados o apagados no se muestran ni se tocan: lo que el rol ya tenga
 * guardado en ellos se conserva.
 */
export async function listEditableModuleKeys(workspaceId: string): Promise<string[]> {
  const enabled = await getEnabledModuleKeysForWorkspace(workspaceId);
  return editableModuleKeys(
    listModules({ status: "AVAILABLE" }).map((m) => m.key),
    enabled,
  );
}
