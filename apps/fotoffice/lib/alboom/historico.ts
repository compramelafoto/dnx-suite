import "server-only";
import { prisma } from "@repo/db";

/**
 * Lo que la migración de Alboom cargó como HISTÓRICO (etapa 8B-2) no dispara nada hacia afuera. Los crons que
 * recorren tablas y mandan cosas (seguimiento de presupuestos, sincronización con Google Calendar: citas y entregas
 * de proyectos) excluyen los registros que están en `FotofficeAlboomMapa` con estos tipos.
 *
 * Los recordatorios de cuotas y de citas no lo necesitan: cada cuota y cada cita cargada nace con su recordatorio
 * "ya avisado". Los contratos tampoco: los firmados nacen con `manualSignedAt` y los otros sin firmantes.
 */

export const TIPOS_HISTORICOS = { PRESUPUESTO: "PRESUPUESTO", CITA: "CITA", PROYECTO: "PROYECTO" } as const;

/** Ids de FOTOFFICE de ese tipo que vienen de Alboom (vacío si no hubo carga). */
export async function idsDeAlboom(workspaceId: string, targetType: (typeof TIPOS_HISTORICOS)[keyof typeof TIPOS_HISTORICOS]): Promise<string[]> {
  const filas = await prisma.fotofficeAlboomMapa.findMany({ where: { workspaceId, targetType }, select: { targetId: true } });
  return [...new Set(filas.map((f) => f.targetId))];
}

/** Condición de Prisma "id que no vino de Alboom" (nada si no hay ninguno). */
export function sinLosDeAlboom(ids: string[], campo = "id"): Record<string, { notIn: string[] }> {
  return ids.length > 0 ? { [campo]: { notIn: ids } } : {};
}
