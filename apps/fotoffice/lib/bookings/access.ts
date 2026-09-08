import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene el rol.
 * Esconder el link del menú es el tercer nivel, el cosmético — nunca el control.
 *
 * Agenda es STAFF+; Espacios, Extras y Tarifas son ADMIN+.
 */

async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, BOOKINGS_MODULE_KEY))) redirect("/dashboard");
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver la agenda. Cualquiera del equipo. */
export async function requireBookingsStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

/** Configurar espacios, extras y tarifas. Solo dueño o administrador. */
export async function requireBookingsAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/reservas");
  return ctx;
}
