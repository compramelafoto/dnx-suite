import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede, type Capacidad } from "@/lib/access/policy";
import { LISTAS } from "./registro";
import type { ContextoListado } from "./tipos";

/** Cómo se nombra a la persona en el registro de actividad. Una sola regla para todas las páginas. */
export function etiquetaDeUsuario(user: { id: number; name?: string | null; email?: string | null }): string {
  return user.name ?? user.email ?? `Usuario ${user.id}`;
}

/**
 * Contexto para acciones y descargas de un listado. Devuelve null ante cualquier falta —sin
 * sesión, sin workspace, módulo apagado, rol sin `operar`— sin distinguir el motivo, y nunca
 * redirige: un redirect en una descarga produce un archivo con HTML adentro.
 */
export async function contextoDeListado(clave: string): Promise<ContextoListado | null> {
  const lista = LISTAS[clave];
  if (!lista) return null;
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, lista.moduleKey))) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };
}

export function exigirCapacidad(ctx: ContextoListado, capacidad: Capacidad): boolean {
  return puede(ctx.role, capacidad);
}
