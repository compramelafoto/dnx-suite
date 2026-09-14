import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SALES_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene rol.
 * Esconder un link del menú es cosmético, nunca control.
 *
 * Vender es STAFF+: es lo que hace el mostrador todo el día, y exigir un administrador para
 * cobrar sería absurdo. Editar el catálogo —dar de alta un producto, tocar su precio o su
 * costo— es ADMIN+: cambia lo que se cobra y el margen del negocio entero, y no es algo que
 * deba poder hacer cualquiera desde el mostrador.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, SALES_MODULE_KEY))) {
    redirect("/dashboard");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

export async function requireSalesStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

export async function requireSalesAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/ventas");
  return ctx;
}
