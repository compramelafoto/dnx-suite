import "server-only";
import { prisma } from "@repo/db";
import { codigoDeError } from "./cliente";
import { contextoGoogle, type MotivoSinGoogle } from "./contexto-google";
import { empujarCitasPendientes, reconciliarEntregas } from "./empuje";
import { traerCambios, type ReporteTraida } from "./traida";

/**
 * Una corrida completa del cron para UNA organización: trae los cambios de Google, empuja las citas que
 * quedaron sin evento y deja las entregas de proyectos tal como corresponde. Nunca lanza: devuelve un
 * reporte con códigos. Un paso que falla no frena a los demás.
 */
export type ReporteSincronizacion = {
  workspaceId: string;
  omitida?: MotivoSinGoogle;
  traida?: ReporteTraida;
  citasEmpujadas: number;
  entregasEscritas: number;
  entregasBorradas: number;
  errores: string[];
};

export async function sincronizarAgenda(workspaceId: string, ahora: Date = new Date()): Promise<ReporteSincronizacion> {
  const reporte: ReporteSincronizacion = { workspaceId, citasEmpujadas: 0, entregasEscritas: 0, entregasBorradas: 0, errores: [] };
  let c;
  try {
    c = await contextoGoogle(workspaceId);
  } catch (error) {
    reporte.errores.push(`CONTEXTO_${codigoDeError(error)}`);
    return reporte;
  }
  if (!c.ok) {
    reporte.omitida = c.motivo;
    return reporte;
  }

  // De ida primero: así lo local que quedó sin empujar no se confunde con una novedad de Google.
  try {
    const e = await empujarCitasPendientes(workspaceId, c.google, ahora);
    reporte.citasEmpujadas = e.empujadas;
    reporte.errores.push(...e.errores.map((x) => `CITAS_${x}`));
  } catch (error) {
    reporte.errores.push(`CITAS_${codigoDeError(error)}`);
  }
  try {
    const e = await reconciliarEntregas(workspaceId, c.google);
    reporte.entregasEscritas = e.escritas;
    reporte.entregasBorradas = e.borradas;
    reporte.errores.push(...e.errores.map((x) => `ENTREGAS_${x}`));
  } catch (error) {
    reporte.errores.push(`ENTREGAS_${codigoDeError(error)}`);
  }
  try {
    reporte.traida = await traerCambios(workspaceId, c.google, ahora);
  } catch (error) {
    reporte.errores.push(`TRAIDA_${codigoDeError(error)}`);
  }
  return reporte;
}

/** Las organizaciones con calendario de Agenda creado y el módulo encendido, las que hace más tiempo no se sincronizan primero. */
export async function organizacionesParaSincronizar(tope: number): Promise<string[]> {
  const conModulo = await prisma.workspaceFeatureModule.findMany({ where: { moduleKey: "agenda", enabled: true }, select: { workspaceId: true } });
  if (conModulo.length === 0) return [];
  const filas = await prisma.fotofficeAgendaAjustes.findMany({
    where: { googleCalendarId: { not: null }, workspaceId: { in: conModulo.map((m) => m.workspaceId as string) } },
    select: { workspaceId: true },
    orderBy: [{ googleLastSyncAt: { sort: "asc", nulls: "first" } }, { workspaceId: "asc" }],
    take: tope,
  });
  return filas.map((f) => f.workspaceId as string);
}
