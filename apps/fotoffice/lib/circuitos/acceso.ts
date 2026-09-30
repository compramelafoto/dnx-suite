import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

/**
 * Quién opera el motor. Lo automático (eventos, enganche de consultas) usa `userId: null` y
 * `userLabel: "Sistema"`.
 */
export type CtxCircuitos = { workspaceId: string; userId: number | null; userLabel: string; role: string | null };

export function contextoDeSistema(workspaceId: string): CtxCircuitos {
  return { workspaceId, userId: null, userLabel: "Sistema", role: null };
}

/**
 * Guarda común de las acciones del motor: sesión, workspace activo y rol con `operar`.
 * Devuelve null ante cualquier falta, sin distinguir el motivo, y nunca redirige. El
 * `workspaceId` sale siempre de la sesión. El módulo del sujeto lo verifica cada acción
 * (este contexto es genérico para todos los tipos de registro).
 */
export async function contextoDeCircuitos(): Promise<CtxCircuitos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  if (!puede(role, "operar")) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role };
}
