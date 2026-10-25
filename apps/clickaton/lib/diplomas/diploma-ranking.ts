import { prisma } from "@repo/db";

/**
 * Ranking general de una edición para el diploma: puesto, calificación y
 * categoría de cada participante.
 *
 * Cada participante sube una foto por consigna, así que tiene tantos puestos
 * como consignas. El diploma muestra uno solo, decidido así (15/10/2026):
 *
 * - **Calificación**: el promedio de sus fotos. Cada foto vale el promedio de
 *   las calificaciones enviadas por los jurados (`totalScore`, de 1 a 10).
 * - **Puesto**: su lugar entre todos los participantes con fotos calificadas,
 *   ordenados por esa calificación. Se compara con dos decimales, que es lo
 *   que se imprime: dos personas con el mismo número impreso comparten puesto
 *   (ranking de competición: 1, 2, 2, 4).
 * - **Categoría**: la consigna de su foto mejor calificada.
 *
 * Se calcula con las calificaciones de los jurados, no con un lote de
 * resultados de FotoRank: el ranking oficial de FotoRank es por consigna y no
 * tiene un orden general entre participantes.
 */

export type DiplomaRankingPhoto = {
  /** Promedio de los jurados para esa foto, de 1 a 10. */
  score: number;
  /** Nombre de la consigna, o null si la foto no tiene consigna. */
  category: string | null;
};

export type DiplomaRankingParticipantRow = {
  registrationId: string;
  photos: DiplomaRankingPhoto[];
};

export type DiplomaRanking = {
  position: number;
  total: number;
  /** Promedio de sus fotos, sin redondear. */
  score: number;
  /** Consigna de su mejor foto. */
  category: string | null;
};

function redondear2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeGeneralRanking(
  rows: DiplomaRankingParticipantRow[]
): Map<string, DiplomaRanking> {
  const calificados = rows
    .filter((r) => r.photos.length > 0)
    .map((r) => {
      const score = r.photos.reduce((acc, p) => acc + p.score, 0) / r.photos.length;
      const mejor = r.photos.reduce((a, b) => (b.score > a.score ? b : a));
      return { registrationId: r.registrationId, score, category: mejor.category };
    })
    .sort((a, b) => b.score - a.score);

  const total = calificados.length;
  const ranking = new Map<string, DiplomaRanking>();
  let position = 0;
  let anterior: number | null = null;
  calificados.forEach((p, i) => {
    const impreso = redondear2(p.score);
    if (impreso !== anterior) position = i + 1;
    anterior = impreso;
    ranking.set(p.registrationId, {
      position,
      total,
      score: p.score,
      category: p.category,
    });
  });
  return ranking;
}

/** "7,20": coma decimal y siempre dos decimales, como se lee en Argentina. */
export function formatDiplomaScore(score: number): string {
  return redondear2(score).toFixed(2).replace(".", ",");
}

/** "4.º" */
export function formatDiplomaPosition(position: number): string {
  return `${position}.º`;
}

/**
 * Variables `diploma.*` del ranking. Quien no tiene fotos calificadas (se
 * acreditó pero no entregó, o el juzgamiento no empezó) recibe todo en
 * blanco: el diploma de participación se emite igual.
 */
export type DiplomaRankingVariables = {
  position: string;
  positionOrdinal: string;
  rankingTotal: string;
  score: string;
  category: string;
};

export function buildDiplomaRankingVariables(
  ranking: DiplomaRanking | null
): DiplomaRankingVariables {
  if (!ranking) {
    return { position: "", positionOrdinal: "", rankingTotal: "", score: "", category: "" };
  }
  return {
    position: String(ranking.position),
    positionOrdinal: formatDiplomaPosition(ranking.position),
    rankingTotal: String(ranking.total),
    score: formatDiplomaScore(ranking.score),
    category: ranking.category ?? "",
  };
}

/**
 * Lee de la base las fotos calificadas de una edición, agrupadas por
 * inscripción. Las obras de una maratón viven en las tablas de FotoRank
 * dentro de la base de Clickatón, enganchadas por `externalEditionId` y
 * `externalRegistrationId`. Sólo cuentan las calificaciones enviadas y no
 * anuladas.
 */
export async function loadEditionRankingRows(
  editionId: string
): Promise<DiplomaRankingParticipantRow[]> {
  const entries = await prisma.fotorankContestEntry.findMany({
    where: { externalEditionId: editionId, externalRegistrationId: { not: null } },
    select: {
      externalRegistrationId: true,
      externalPromptId: true,
      jurySnapshots: {
        select: {
          juryEvaluations: {
            where: { status: "SUBMITTED", voidedAt: null, totalScore: { not: null } },
            select: { totalScore: true },
          },
        },
      },
    },
  });

  const promptIds = [
    ...new Set(entries.map((e) => e.externalPromptId).filter((x): x is string => !!x)),
  ];
  const prompts = promptIds.length
    ? await prisma.clickatonPrompt.findMany({
        where: { id: { in: promptIds } },
        select: { id: true, title: true, internalName: true },
      })
    : [];
  const nombreConsigna = new Map(
    prompts.map((p) => [p.id, p.title?.trim() || p.internalName.trim()])
  );

  const porInscripcion = new Map<string, DiplomaRankingPhoto[]>();
  for (const e of entries) {
    const notas = e.jurySnapshots.flatMap((s) =>
      s.juryEvaluations.map((ev) => ev.totalScore as number)
    );
    if (notas.length === 0) continue;
    const score = notas.reduce((a, b) => a + b, 0) / notas.length;
    const regId = e.externalRegistrationId as string;
    const fotos = porInscripcion.get(regId) ?? [];
    fotos.push({
      score,
      category: e.externalPromptId ? nombreConsigna.get(e.externalPromptId) ?? null : null,
    });
    porInscripcion.set(regId, fotos);
  }

  return [...porInscripcion.entries()].map(([registrationId, photos]) => ({
    registrationId,
    photos,
  }));
}

/** El ranking de una inscripción, o null si no tiene fotos calificadas. */
export async function loadDiplomaRanking(input: {
  editionId: string;
  registrationId: string;
}): Promise<DiplomaRanking | null> {
  const rows = await loadEditionRankingRows(input.editionId);
  return computeGeneralRanking(rows).get(input.registrationId) ?? null;
}
