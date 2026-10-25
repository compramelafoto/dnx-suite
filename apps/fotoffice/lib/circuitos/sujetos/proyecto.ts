import "server-only";
import { prisma } from "@repo/db";
import { fechaValida } from "@/lib/proyectos/fechas";
import type { Adaptador, NombreDeSujeto } from "./tipos";

export const PROJECTS_MODULE_KEY = "projects";

export function hrefDeProyecto(id: string): string {
  return `/proyectos/${encodeURIComponent(id)}`;
}

/**
 * Proyectos: el sujeto es un `FotofficeProyecto`. Recorre un circuito de clase TRABAJO. El motor
 * no necesita tocar nada del proyecto al cambiar de etapa (el estado es el recorrido mismo); lo
 * único propio es el plan: si el proyecto tiene fecha planificada para la etapa, las tareas
 * modelo vencen según ese plan (`fechaPlanificada`).
 */
export const adaptadorProyecto: Adaptador = {
  moduleKey: PROJECTS_MODULE_KEY,
  rutaTablero: "/proyectos",
  rutaFicha: hrefDeProyecto,

  async existe(tx, workspaceId, id) {
    return (await tx.fotofficeProyecto.count({ where: { id, workspaceId } })) > 0;
  },

  async nombre(workspaceId, ids) {
    const mapa = new Map<string, NombreDeSujeto>();
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return mapa;
    const filas = await prisma.fotofficeProyecto.findMany({
      where: { workspaceId, id: { in: unicos } },
      select: { id: true, name: true, number: true },
    });
    for (const f of filas) {
      mapa.set(f.id, { titulo: f.name, ...(f.number ? { subtitulo: f.number } : {}), href: hrefDeProyecto(f.id) });
    }
    return mapa;
  },

  async fechaPlanificada(tx, workspaceId, id, stageId) {
    const plan = await tx.fotofficeProyectoEtapaPlan.findFirst({
      where: { workspaceId, proyectoId: id, stageId },
      select: { plannedDueDate: true },
    });
    return plan ? fechaValida(plan.plannedDueDate) : null;
  },
};
