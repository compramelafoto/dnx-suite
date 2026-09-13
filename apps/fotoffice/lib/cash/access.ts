import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CASH_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene rol.
 * Esconder el link del menú es un tercer nivel, el cosmético — nunca el control.
 *
 * Ver el libro, cargar movimientos y abrir o cerrar turno es STAFF+, no ADMIN+: era la
 * única pregunta abierta del diseño (§15.2) y se resuelve acá. Un negocio con empleados de
 * mostrador no puede exigir que el dueño abra la caja todas las mañanas, y el arqueo ya deja
 * registrado quién abrió y quién cerró, que es lo que de verdad importa para responder por
 * una diferencia. Cuentas y categorías sí quedan en ADMIN+: son la configuración de la que
 * dependen todos los reportes, y equivocarla es más caro de deshacer que un arqueo.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, CASH_MODULE_KEY))) {
    redirect("/dashboard");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

export async function requireCashStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

export async function requireCashAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/caja");
  return ctx;
}
