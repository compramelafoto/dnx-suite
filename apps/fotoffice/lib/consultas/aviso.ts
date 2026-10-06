import "server-only";
import { prisma } from "@repo/db";
import { avisarEquipoConsultaNueva, type ResultadoAutomatico } from "@/lib/plantillas/automaticos";
import type { DepsEnvio } from "@/lib/plantillas/envio";
import { inicioDelDiaAR } from "@/lib/plantillas/envio";
import { asegurarAvisoEquipo } from "@/lib/plantillas/semillas";
import { AJUSTES_DE_FABRICA, leerAjustes, puedeSerResponsable, type AjustesConsultas, type DepsAjustes } from "./ajustes";

/**
 * Aviso de consulta nueva (spec §4.3): un correo interno con la plantilla del sistema
 * `CONSULTA_AVISO_EQUIPO` y la tarea "Responder consulta", que vence el mismo día a las 23:59 de
 * Buenos Aires. Los dos se pueden apagar en Configuración → Consultas → Avisos.
 *
 * Destinatario: el responsable de la consulta (si el alta lo eligió), si no el de los ajustes, y
 * si ninguno sirve (ya no es del equipo o perdió "Gestionar" en Consultas), el dueño.
 *
 * Nunca lanza: la consulta ya quedó creada. Los errores van al registro sólo con su código.
 */

export const TITULO_TAREA_RESPONDER = "Responder consulta";
/** 23:59 del día: 23 h 59 min después del comienzo del día de Buenos Aires. */
const HASTA_LAS_2359_MS = (23 * 60 + 59) * 60 * 1000;

export type DepsAviso = DepsEnvio & DepsAjustes;

export type ResultadoAviso = {
  destinatarioUserId: number | null;
  correo: ResultadoAutomatico | "SIN_DESTINATARIO" | "OMITIDO";
  tarea: "CREADA" | "OMITIDA" | "ERROR";
};

function registrarFalla(donde: string, error: unknown): void {
  const e = error as { name?: string; code?: string } | null;
  console.error(`[consultas] ${donde} falló`, { error: e?.name ?? "desconocido", codigo: e?.code ?? null });
}

/** Vencimiento de la tarea: hoy a las 23:59, hora de Buenos Aires (UTC−3 fijo). */
export function venceHoyALas2359(ahora: Date): Date {
  return new Date(inicioDelDiaAR(ahora).getTime() + HASTA_LAS_2359_MS);
}

async function dueno(workspaceId: string): Promise<number | null> {
  const m = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, role: "WORKSPACE_OWNER" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return m?.userId ?? null;
}

/** El primero de los candidatos que puede ser responsable; si ninguno, el dueño. */
export async function destinatarioDelAviso(
  workspaceId: string,
  candidatos: (number | null | undefined)[],
  deps: DepsAjustes = {},
): Promise<number | null> {
  const vistos = new Set<number>();
  for (const c of candidatos) {
    if (typeof c !== "number" || vistos.has(c)) continue;
    vistos.add(c);
    if (await puedeSerResponsable(workspaceId, c, deps)) return c;
  }
  return dueno(workspaceId);
}

export async function avisarConsultaNueva(
  workspaceId: string,
  leadId: string,
  opciones: { responsableUserId?: number | null } = {},
  deps: DepsAviso = {},
): Promise<ResultadoAviso> {
  const resultado: ResultadoAviso = { destinatarioUserId: null, correo: "OMITIDO", tarea: "OMITIDA" };
  let ajustes: AjustesConsultas = AJUSTES_DE_FABRICA;
  try {
    ajustes = await leerAjustes(workspaceId);
  } catch (error) {
    registrarFalla("leerAjustes", error);
  }
  if (!ajustes.crearTarea && !ajustes.notificarCorreo) return resultado;

  try {
    resultado.destinatarioUserId = await destinatarioDelAviso(workspaceId, [opciones.responsableUserId, ajustes.responsableUserId], deps);
  } catch (error) {
    registrarFalla("destinatarioDelAviso", error);
  }
  const para = resultado.destinatarioUserId;

  if (ajustes.crearTarea) {
    try {
      const ahora = (deps.ahora ?? (() => new Date()))();
      const recorrido = await prisma.fotofficeJourney.findFirst({
        where: { workspaceId, subjectType: "CAPTACION", subjectId: leadId, kind: "VENTA", closedAt: null },
        select: { id: true },
      });
      await prisma.fotofficeTask.create({
        data: {
          workspaceId,
          journeyId: recorrido?.id ?? null,
          stageId: null,
          subjectType: "CAPTACION",
          subjectId: leadId,
          title: TITULO_TAREA_RESPONDER,
          dueAt: venceHoyALas2359(ahora),
          required: false,
          // Sin nadie a quien asignarla (ni dueño), queda sin asignar: se ve en la consulta.
          assigneeUserId: para,
          createdByUserId: null,
        },
        select: { id: true },
      });
      resultado.tarea = "CREADA";
    } catch (error) {
      resultado.tarea = "ERROR";
      registrarFalla("crearTareaResponder", error);
    }
  }

  if (ajustes.notificarCorreo) {
    if (para === null) {
      resultado.correo = "SIN_DESTINATARIO";
    } else {
      try {
        const usuario = await prisma.user.findUnique({ where: { id: para }, select: { email: true, name: true } });
        await asegurarAvisoEquipo(workspaceId);
        resultado.correo = await avisarEquipoConsultaNueva(
          workspaceId,
          leadId,
          { email: usuario?.email ?? null, nombre: usuario?.name ?? null },
          deps,
        );
      } catch (error) {
        resultado.correo = "ERROR";
        registrarFalla("avisarEquipo", error);
      }
    }
  }
  return resultado;
}
