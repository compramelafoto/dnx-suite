import "server-only";
import { responsablesDe } from "@/lib/circuitos/tablero";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { PROJECTS_MODULE_KEY } from "./acceso";

/** Quiénes pueden ser responsables: del equipo y con "Gestionar" en Proyectos. Ordenados por nombre. */
export async function equipoDeProyectos(workspaceId: string): Promise<{ id: number; nombre: string }[]> {
  const equipo = (await responsablesDe(workspaceId)).slice(0, 200);
  const marcas = await Promise.all(equipo.map((r) => hasModuleLevel(r.id, workspaceId, PROJECTS_MODULE_KEY, "MANAGE")));
  return equipo.filter((_r, i) => marcas[i]);
}
