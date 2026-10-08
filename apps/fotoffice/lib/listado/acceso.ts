import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede, puedeEnContexto, type Capacidad } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { entradaDeLista, listaPermitida } from "./registro";
import type { ContextoListado } from "./tipos";

/** Cómo se nombra a la persona en el registro de actividad. Una sola regla para todas las páginas. */
export function etiquetaDeUsuario(user: { id: number; name?: string | null; email?: string | null }): string {
  return user.name?.trim() || user.email?.trim() || `Usuario ${user.id}`;
}

/**
 * Contexto para acciones y descargas de un listado. Devuelve null ante cualquier falta —sin
 * sesión, sin workspace, módulo apagado, sin nivel "Ver" en el módulo de la lista, sin la condición
 * extra de la lista (`permitido` en el registro)— sin distinguir
 * el motivo, y nunca redirige: un redirect en una descarga produce un archivo con HTML adentro.
 * Las acciones en lote y la exportación exigen además `operar` (nivel "Gestionar") con
 * `exigirCapacidad`, que mira el mismo módulo.
 */
export async function contextoDeListado(clave: string): Promise<ContextoListado | null> {
  const lista = entradaDeLista(clave);
  if (!lista) return null;
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, lista.moduleKey))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "ver", lista.moduleKey)) return null;
  const ctx: ContextoListado = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role: acceso.role,
    acceso,
    modulo: lista.moduleKey,
  };
  // Las listas enteras de dinero piden algo más que "Ver" (p. ej. "A pagar": ver costos).
  return listaPermitida(clave, ctx) ? ctx : null;
}

/**
 * Contexto de un listado para su página, que ya pasó la guarda del módulo (nivel "Ver"). Lleva
 * el acceso resuelto para que las acciones visibles, compartir vistas y exportar se decidan con
 * la misma regla que después aplican las acciones.
 */
export async function contextoListadoDePagina(
  user: { id: number; name?: string | null; email?: string | null },
  workspace: { id: string; name: string },
  modulo: string,
): Promise<ContextoListado> {
  const acceso = await resolverAcceso(user.id, workspace.id);
  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role: acceso.role,
    acceso,
    modulo,
  };
}

/** `operar`/`ver` se miden sobre el módulo de la lista; las demás capacidades, por rol. */
export function exigirCapacidad(ctx: ContextoListado, capacidad: Capacidad): boolean {
  return puedeEnContexto(ctx, capacidad, ctx.modulo);
}
