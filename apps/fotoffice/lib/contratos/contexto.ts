import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { CONTRACTS_MODULE_KEY, type CtxContratos } from "./acceso";

/**
 * Guarda de las acciones y pantallas de Contratos, en este orden: sesión, workspace activo, módulo
 * `contracts` encendido y el nivel pedido ("ver" = Ver; "operar" = Gestionar). Igual que
 * `lib/agenda/contexto.ts`: null ante cualquier falta, sin decir el motivo.
 */
export async function contextoDeContratos(nivel: "ver" | "operar"): Promise<CtxContratos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, CONTRACTS_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, nivel, CONTRACTS_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}

/** ¿Está encendido el módulo en este workspace? (Para las pantallas que se muestran o no.) */
export function contratosEncendidos(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, CONTRACTS_MODULE_KEY);
}
