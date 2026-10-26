"use server";

import { MENSAJES_PROYECTO } from "@/lib/proyectos/acceso";
import { contextoDeProyectos } from "@/lib/proyectos/contexto";
import { cargarDetalleTrabajo, type DetalleTrabajo } from "@/lib/proyectos/en-curso-detalle";

/** El detalle de un trabajo para la ficha flotante del tablero "En curso" (sólo lectura). */
export async function detalleTrabajoAction(proyectoId: string): Promise<{ ok: true; detalle: DetalleTrabajo } | { ok: false; error: string }> {
  const ctx = await contextoDeProyectos("ver");
  if (!ctx) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  const detalle = await cargarDetalleTrabajo(ctx, proyectoId, new Date());
  return detalle ? { ok: true, detalle } : { ok: false, error: "No se encontró el trabajo." };
}
