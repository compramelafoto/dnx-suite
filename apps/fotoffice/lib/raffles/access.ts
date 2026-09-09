import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { RAFFLES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene el rol.
 * Esconder el link del menú es el tercer nivel, el cosmético — nunca el control.
 *
 * Ver la lista y entregar premios es STAFF+. Crear, anunciar, sellar, resolver y cancelar es
 * ADMIN+: son los actos que definen el resultado, y quien los hace queda con nombre y
 * apellido en la historia del sorteo.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, RAFFLES_MODULE_KEY))) redirect("/dashboard");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver los sorteos y entregar premios. Cualquiera del equipo. */
export async function requireRafflesStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

/** Crear, anunciar, sellar, resolver, cancelar. Sólo dueño o administrador. */
export async function requireRafflesAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/sorteos");
  return ctx;
}
