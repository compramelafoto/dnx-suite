import "server-only";

import { prisma } from "@/lib/admin/db";

import {
  armarResultados,
  REGLA_DE_FABRICA_DE_MARATON,
  type FilaDeResultado,
  type ReglaDeResultados,
  type ResultadosDeEdicion,
} from "./armar-resultados";

export type AutorDeObra = {
  registrationId: string;
  submissionId: string | null;
  nombre: string;
  email: string;
  numero: string | null;
  instagram: string | null;
};

export type FilaConAutor = FilaDeResultado & { autor: AutorDeObra | null };

export type ResultadosConAutores = Omit<ResultadosDeEdicion, "filas"> & {
  sesion: { id: string; status: string; scoreScaleMax: number };
  notasEnviadas: number;
  notasEnCurso: number;
  filas: FilaConAutor[];
};

/**
 * Lee el juzgamiento de una edición y arma su ranking con nombre y foto.
 *
 * Todo vive en la base de Clickatón —obras congeladas, notas del jurado y el
 * lote que cierra FotoRank—, así que alcanza con el cliente de siempre.
 * Devuelve null si la edición todavía no abrió su juzgamiento.
 */
export async function cargarResultadosDeEdicion(
  editionId: string,
): Promise<ResultadosConAutores | null> {
  const sesion = await prisma.fotorankJuryScoringSession.findFirst({
    where: { admissionBatch: { editionId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      admissionBatchId: true,
      minimumEvaluationsPerEntry: true,
      scoreScaleMax: true,
    },
  });
  if (!sesion) return null;

  const [snapshots, reglaGuardada, loteFinal] = await Promise.all([
    prisma.fotorankJuryEntrySnapshot.findMany({
      where: { admissionBatchId: sesion.admissionBatchId },
      select: {
        id: true,
        anonymousCode: true,
        categoryId: true,
        promptExternalId: true,
        entryId: true,
        entry: {
          select: { status: true, admissionStatus: true, externalRegistrationId: true },
        },
      },
    }),
    prisma.fotorankResultRuleSet
      .findMany({
        where: { scoringSessionId: sesion.id, status: { in: ["ACTIVE", "DRAFT"] } },
        orderBy: { version: "desc" },
      })
      // La activa manda; si no hay, la última en borrador.
      .then((reglas) => reglas.find((r) => r.status === "ACTIVE") ?? reglas[0] ?? null),
    prisma.fotorankResultBatch.findFirst({
      where: { scoringSessionId: sesion.id, status: { in: ["FINALIZED", "PUBLISHED"] } },
      orderBy: { finalizedAt: "desc" },
      select: {
        entries: {
          select: {
            juryEntrySnapshotId: true,
            aggregateScore: true,
            evaluationCount: true,
            preliminaryPosition: true,
            finalPosition: true,
            awardType: true,
            resultStatus: true,
          },
        },
      },
    }),
  ]);

  const regla: ReglaDeResultados = reglaGuardada
    ? {
        aggregationMethod: reglaGuardada.aggregationMethod,
        tieBreakStrategy: reglaGuardada.tieBreakStrategy,
        minimumValidEvaluations: reglaGuardada.minimumValidEvaluations,
        discardHighestScore: reglaGuardada.discardHighestScore,
        discardLowestScore: reglaGuardada.discardLowestScore,
        priorityCriterionKey: reglaGuardada.priorityCriterionKey,
        ruleSetVersion: reglaGuardada.version,
        winnersPerScope: reglaGuardada.winnersPerScope,
      }
    : { ...REGLA_DE_FABRICA_DE_MARATON, minimumValidEvaluations: sesion.minimumEvaluationsPerEntry };

  const claveDePrioridad = regla.priorityCriterionKey ?? null;
  const [notas, notasEnCurso] = await Promise.all([
    prisma.fotorankJuryEvaluation.findMany({
      where: { scoringSessionId: sesion.id, status: { in: ["SUBMITTED", "LOCKED"] } },
      select: {
        juryEntrySnapshotId: true,
        status: true,
        totalScore: true,
        normalizedScore: true,
        criterionScores: claveDePrioridad
          ? { where: { criterionKeySnapshot: claveDePrioridad }, select: { score: true } }
          : false,
      },
    }),
    prisma.fotorankJuryEvaluation.count({
      where: { scoringSessionId: sesion.id, status: "IN_PROGRESS" },
    }),
  ]);

  const resultados = armarResultados({
    obras: snapshots.map((s) => ({
      snapshotId: s.id,
      anonymousCode: s.anonymousCode,
      categoryId: s.categoryId,
      promptExternalId: s.promptExternalId,
      admissionStatus: s.entry.admissionStatus ?? "NOT_EVALUATED",
      entryStatus: s.entry.status,
    })),
    notas: notas.map((n) => ({
      snapshotId: n.juryEntrySnapshotId,
      status: n.status,
      totalScore: n.totalScore,
      normalizedScore: n.normalizedScore,
      priorityCriterionScore:
        (n.criterionScores as { score: number }[] | undefined)?.[0]?.score ?? null,
    })),
    regla,
    loteFinal: loteFinal
      ? loteFinal.entries.map((e) => ({
          snapshotId: e.juryEntrySnapshotId,
          aggregateScore: e.aggregateScore,
          evaluationCount: e.evaluationCount,
          preliminaryPosition: e.preliminaryPosition,
          finalPosition: e.finalPosition,
          awardType: e.awardType,
          resultStatus: e.resultStatus,
        }))
      : null,
  });

  const autores = await autoresDeLasObras(
    snapshots.map((s) => ({
      snapshotId: s.id,
      entryId: s.entryId,
      registrationId: s.entry.externalRegistrationId,
    })),
  );

  return {
    ...resultados,
    sesion: { id: sesion.id, status: sesion.status, scoreScaleMax: sesion.scoreScaleMax },
    notasEnviadas: notas.length,
    notasEnCurso,
    filas: resultados.filas.map((f) => ({ ...f, autor: autores.get(f.snapshotId) ?? null })),
  };
}

async function autoresDeLasObras(
  obras: { snapshotId: string; entryId: string; registrationId: string | null }[],
): Promise<Map<string, AutorDeObra>> {
  const registrationIds = [
    ...new Set(obras.map((o) => o.registrationId).filter((id): id is string => Boolean(id))),
  ];
  const [inscripciones, envios] = await Promise.all([
    prisma.clickatonRegistration.findMany({
      where: { id: { in: registrationIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        visibleCode: true,
        instagramHandle: true,
      },
    }),
    prisma.clickatonPhotoSubmission.findMany({
      where: { fotorankEntryId: { in: obras.map((o) => o.entryId) } },
      select: { id: true, fotorankEntryId: true },
    }),
  ]);
  const inscripcionPorId = new Map(inscripciones.map((i) => [i.id, i]));
  const envioPorEntrada = new Map(envios.map((e) => [e.fotorankEntryId, e.id]));

  const autores = new Map<string, AutorDeObra>();
  for (const o of obras) {
    const i = o.registrationId ? inscripcionPorId.get(o.registrationId) : undefined;
    if (!i) continue;
    autores.set(o.snapshotId, {
      registrationId: i.id,
      submissionId: envioPorEntrada.get(o.entryId) ?? null,
      nombre: `${i.firstName} ${i.lastName}`.trim(),
      email: i.email,
      numero: i.visibleCode,
      instagram: i.instagramHandle,
    });
  }
  return autores;
}
