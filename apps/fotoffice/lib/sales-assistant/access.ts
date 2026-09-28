import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { SALES_ASSISTANT_MODULE_KEY } from "./constants";

/**
 * Control de acceso del Asistente de ventas, siempre en el servidor.
 *
 * Mismo orden que `lib/coverages/access.ts`: primero que el módulo esté encendido para ESE
 * workspace y recién después el rol, para que un workspace sin el módulo no se entere, por la vía
 * del mensaje, de que existe.
 *
 * Un solo nivel de rol: la bandeja muestra teléfonos de clientes y la configuración guarda la
 * contraseña del CRM, así que no hay una versión "de sólo lectura" que tenga sentido darle al
 * personal. Es el mismo permiso que editar los datos de la institución.
 */
export async function requireSalesAssistantManager() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, SALES_ASSISTANT_MODULE_KEY))) {
    redirect("/dashboard?ventas=off");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!canManageWorkspaceSettings(role)) redirect("/dashboard");
  return { user, workspace, role };
}
