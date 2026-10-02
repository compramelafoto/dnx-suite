import "server-only";
import { redirect } from "next/navigation";
import { puede } from "@/lib/access/policy";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "./constants";

/**
 * Captación (formularios de pedidos de servicio): cualquiera del equipo que opera, con el módulo
 * encendido para el workspace (como los demás módulos; antes bastaba con tener rol).
 * El Colaborador y quien no tiene rol en el workspace activo vuelven al panel.
 *
 * Sin workspace activo devuelve `workspace: null` como antes: las pantallas ya muestran
 * su propio aviso para ese caso.
 */
export async function requireServiceLeadsStaff() {
  const { user, workspace } = await requireActiveWorkspace();
  if (workspace) {
    if (!(await isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY))) redirect("/dashboard");
    const role = await resolveWorkspaceRole(user.id, workspace.id);
    if (!puede(role, "operar")) redirect("/dashboard");
  }
  return { user, workspace };
}
