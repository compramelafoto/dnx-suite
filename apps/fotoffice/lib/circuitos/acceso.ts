import "server-only";
import { getAuthUser } from "@/lib/auth";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { puede, type AccesoEfectivo } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";

/**
 * Quién opera el motor. Lo automático (eventos, enganche de consultas) usa `userId: null` y
 * `userLabel: "Sistema"`.
 */
export type CtxCircuitos = {
  workspaceId: string;
  userId: number | null;
  userLabel: string;
  role: string | null;
  /** Acceso efectivo (modelo de main). Ausente en el contexto de sistema. */
  acceso?: AccesoEfectivo;
};

/** Módulos de los sujetos del motor: Captación (consultas) y Proyectos. */
const MODULOS_DEL_MOTOR = [SERVICE_LEADS_MODULE_KEY, PROJECTS_MODULE_KEY];

export function contextoDeSistema(workspaceId: string): CtxCircuitos {
  return { workspaceId, userId: null, userLabel: "Sistema", role: null };
}

/**
 * Guarda común de las acciones del motor: sesión, workspace activo y `operar` (nivel
 * "Gestionar") en el módulo de algún sujeto del motor (Captación o Proyectos). Es sólo la puerta
 * de entrada: la decisión de verdad la toma cada acción sobre el módulo del sujeto que toca
 * (`preparar` en `app/actions/circuitos.ts` busca el recorrido y exige "Gestionar" en el módulo de
 * SU tipo), así que quien sólo gestiona Consultas no puede tocar un proyecto y viceversa.
 * Devuelve null ante cualquier falta, sin distinguir el motivo, y nunca redirige. El
 * `workspaceId` sale siempre de la sesión. El módulo del sujeto lo verifica cada acción
 * (este contexto es genérico para todos los tipos de registro).
 */
export async function contextoDeCircuitos(): Promise<CtxCircuitos | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "operar", MODULOS_DEL_MOTOR)) return null;
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso };
}
