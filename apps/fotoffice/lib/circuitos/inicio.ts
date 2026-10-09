import "server-only";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import type { TipoSujeto } from "./constantes";
import { resolverAcceso } from "@/lib/access/acceso";
import { misTareas, type TareaVista } from "./tareas";

/** Una tarea del bloque "Mis tareas" del inicio, lista para un componente de cliente. */
export type TareaInicio = Omit<TareaVista, "vence"> & { vence: string };
export type MisTareasInicio = { vencidas: TareaInicio[]; hoy: TareaInicio[]; proximas: TareaInicio[] };

const aVista = (t: TareaVista): TareaInicio => ({ ...t, vence: t.vence!.toISOString() });

/**
 * Los tipos de registro cuyas tareas puede ver quien entra: Consultas con "Gestionar" en Consultas
 * y el módulo encendido; Proyectos con "Gestionar" en Proyectos y el módulo encendido. Puro salvo
 * la pregunta por el módulo, que se hace sólo para lo que el rol ya permite.
 */
export async function tiposConTareasVisibles(
  acceso: Parameters<typeof puede>[0],
  workspaceId: string,
): Promise<TipoSujeto[]> {
  const tipos: TipoSujeto[] = [];
  if (puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY) && (await isModuleEnabledForWorkspace(workspaceId, SERVICE_LEADS_MODULE_KEY))) tipos.push("CAPTACION");
  if (puede(acceso, "operar", PROJECTS_MODULE_KEY) && (await isModuleEnabledForWorkspace(workspaceId, PROJECTS_MODULE_KEY))) tipos.push("PROYECTO");
  return tipos;
}

/**
 * "Mis tareas" del inicio: para quien puede `operar` (nivel "Gestionar") en Consultas o en
 * Proyectos con ese módulo encendido, y sólo con las tareas de los tipos que puede gestionar.
 * Devuelve null si no corresponde mostrar el bloque (sin permiso, módulo apagado, sin tareas) o si
 * algo falla: el inicio nunca se rompe por esto. El error se registra sin datos personales (sólo
 * su tipo).
 */
export async function misTareasDelInicio(
  user: { id: number; name?: string | null; email?: string | null },
  workspaceId: string,
  ahora: Date,
): Promise<MisTareasInicio | null> {
  try {
    const acceso = await resolverAcceso(user.id, workspaceId);
    const tipos = await tiposConTareasVisibles(acceso, workspaceId);
    if (tipos.length === 0) return null;
    const g = await misTareas(
      { workspaceId, userId: user.id, userLabel: etiquetaDeUsuario(user), role: acceso.role, acceso },
      ahora,
      tipos,
    );
    if (g.vencidas.length + g.hoy.length + g.proximas.length === 0) return null;
    return { vencidas: g.vencidas.map(aVista), hoy: g.hoy.map(aVista), proximas: g.proximas.map(aVista) };
  } catch (error) {
    const tipo = error instanceof Error ? error.name : typeof error;
    const codigo = (error as { code?: unknown } | null)?.code;
    console.error("[inicio] No se pudieron cargar Mis tareas", { tipo, ...(typeof codigo === "string" ? { codigo } : {}) });
    return null;
  }
}
