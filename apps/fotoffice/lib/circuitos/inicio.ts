import "server-only";
import { puede } from "@/lib/access/policy";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { misTareas, type TareaVista } from "./tareas";

/** Una tarea del bloque "Mis tareas" del inicio, lista para un componente de cliente. */
export type TareaInicio = Omit<TareaVista, "vence"> & { vence: string };
export type MisTareasInicio = { vencidas: TareaInicio[]; hoy: TareaInicio[]; proximas: TareaInicio[] };

const aVista = (t: TareaVista): TareaInicio => ({ ...t, vence: t.vence!.toISOString() });

/**
 * "Mis tareas" del inicio: sólo para quien puede `operar` en el workspace activo y con el módulo
 * de Captación encendido. Devuelve null si no corresponde mostrar el bloque (sin permiso, módulo
 * apagado, sin tareas) o si algo falla: el inicio nunca se rompe por esto. El error se registra
 * sin datos personales (sólo su tipo).
 */
export async function misTareasDelInicio(
  user: { id: number; name?: string | null; email?: string | null },
  workspaceId: string,
  ahora: Date,
): Promise<MisTareasInicio | null> {
  try {
    const role = await resolveWorkspaceRole(user.id, workspaceId);
    if (!puede(role, "operar")) return null;
    if (!(await isModuleEnabledForWorkspace(workspaceId, SERVICE_LEADS_MODULE_KEY))) return null;
    const g = await misTareas({ workspaceId, userId: user.id, userLabel: etiquetaDeUsuario(user), role }, ahora);
    if (g.vencidas.length + g.hoy.length + g.proximas.length === 0) return null;
    return { vencidas: g.vencidas.map(aVista), hoy: g.hoy.map(aVista), proximas: g.proximas.map(aVista) };
  } catch (error) {
    const tipo = error instanceof Error ? error.name : typeof error;
    const codigo = (error as { code?: unknown } | null)?.code;
    console.error("[inicio] No se pudieron cargar Mis tareas", { tipo, ...(typeof codigo === "string" ? { codigo } : {}) });
    return null;
  }
}
