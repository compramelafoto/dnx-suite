import "server-only";
import { prisma } from "@repo/db";
import { canSeeIdentity, curatorImagePath, rankWorks, type RankingRow } from "@repo/muestras";

export type FilaSeleccion = RankingRow & {
  title: string;
  year: number | null;
  technique: string | null;
  statement: string | null;
  imagePath: string;
  /** Notas de los curadores, sin decir de quién. */
  notes: string[];
  /** Sólo con la selección cerrada (`canSeeIdentity`). */
  authorName: string | null;
};

/**
 * El ranking que ve el organizador. Antes del cierre de la curaduría la consulta ni siquiera pide
 * el nombre del autor; la imagen va siempre por la ruta anónima. Cuentan sólo los puntajes de
 * curadores activos (uno revocado deja de pesar).
 */
export async function rankingDeLaConvocatoria(callId: string, status: string): Promise<FilaSeleccion[]> {
  const identidad = canSeeIdentity(status);
  const obras = await prisma.culturalCallWork.findMany({
    where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } },
    select: {
      id: true, anonymousCode: true, decision: true, title: true, year: true, technique: true, statement: true,
      ...(identidad ? { submission: { select: { authorName: true } } } : {}),
    },
  });
  const puntajes = await prisma.culturalCallScore.findMany({
    where: { callWork: { callId }, curator: { status: "ACTIVE" } },
    select: { callWorkId: true, score: true, note: true },
  });
  const porId = new Map(obras.map((o) => [o.id, o]));
  return rankWorks(obras, puntajes).map((r) => {
    const o = porId.get(r.workId)!;
    const autor = identidad && "submission" in o ? (o.submission as { authorName: string }).authorName : null;
    return {
      ...r,
      title: o.title, year: o.year, technique: o.technique, statement: o.statement,
      imagePath: curatorImagePath(o.id),
      notes: puntajes.filter((p) => p.callWorkId === o.id && p.note).map((p) => p.note!),
      authorName: autor,
    };
  });
}

/**
 * Avance de cada curador (cuántas puntuó de cuántas). El organizador conoce a su equipo. Las
 * puntuadas se cuentan sobre el mismo universo que el total: sin obras de envíos retirados.
 */
export async function avanceDelEquipo(callId: string) {
  const [curadores, total] = await Promise.all([
    prisma.culturalCallCurator.findMany({ where: { callId, status: "ACTIVE" }, select: { id: true, email: true, _count: { select: { scores: { where: { callWork: { anonymousCode: { not: null }, submission: { status: "ACTIVE" } } } } } } }, orderBy: { acceptedAt: "asc" } }),
    prisma.culturalCallWork.count({ where: { callId, anonymousCode: { not: null }, submission: { status: "ACTIVE" } } }),
  ]);
  return curadores.map((k) => ({ id: k.id, email: k.email, puntuadas: k._count.scores, total }));
}

/**
 * Cuántas obras elegidas (de envíos vigentes) no están en la galería de la muestra: las que nunca
 * se copiaron y las copiadas que después se borraron. Con alguna, se puede volver a armar.
 */
export async function elegidasFueraDeLaGaleria(callId: string, activityId: string): Promise<number> {
  const [elegidas, galeria] = await Promise.all([
    prisma.culturalCallWork.findMany({ where: { callId, decision: "SELECTED", submission: { status: "ACTIVE" } }, select: { activityWorkId: true } }),
    prisma.culturalActivityWork.findMany({ where: { activityId }, select: { id: true } }),
  ]);
  const ids = new Set(galeria.map((w) => w.id));
  return elegidas.filter((e) => !e.activityWorkId || !ids.has(e.activityWorkId)).length;
}
