import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene rol.
 * Ver, cargar y desactivar un cliente es STAFF+: desactivar es reversible y de bajo riesgo
 * —no borra nada, sólo lo saca de las listas por omisión— y exigir un administrador para eso
 * dejaría al mostrador sin forma de ordenar su propio padrón. `requireClientsAdmin` queda
 * disponible para lo que sí necesite ese nivel más adelante.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY))) {
    redirect("/dashboard");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

export async function requireClientsStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

export async function requireClientsAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/clientes");
  return ctx;
}
