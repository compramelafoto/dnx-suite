import { randomBytes } from "node:crypto";
import { baseDelConcurso } from "./baseDelConcurso";
import { JuryError } from "./errors";
import { enqueueJuryNotificationIntent } from "./notification-intents";
import { computePrivateAggregates } from "./scoring-engine";
import {
  criteriosDesdeLasReglas,
  criteriosParaConcurso,
  minimoDeEvaluacionesPorObra,
} from "./criteriosDeLaRubrica";
import {
  etiquetaDelTipo,
  rubricaParaTipo,
  type ConfiguracionDeCalificacion,
} from "./tiposDeCalificacion";

function newId() {
  return `js${randomBytes(12).toString("hex")}`;
}

async function writeSessionAudit(input: {
  contestId: string;
  actorUserId: number;
  eventType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;
  await db.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: "FotorankJuryScoringSession",
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}


export async function ensureDraftRubric(input: {
  contestId: string;
  admissionBatchId: string;
  actorUserId: number;
  localExample?: boolean;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const existing = await db.fotorankJuryRubric.findFirst({
    where: { contestId: input.contestId, admissionBatchId: input.admissionBatchId },
    orderBy: { version: "desc" },
    include: { criteria: true },
  });
  if (existing) return existing;

  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true, distributionChannel: true },
  });
  const isSantaFe = contest?.slug === "santa-fe-en-foco";
  const esDeClickaton = contest?.distributionChannel === "CLICKATON";
  const rubricName = esDeClickaton
    ? "Clickatón — 4 criterios de las bases"
    : isSantaFe
      ? "Santa Fe en Foco — rúbrica staging (borrador legal)"
      : input.localExample || process.env.NODE_ENV !== "production"
        ? "Rúbrica ejemplo (local)"
        : "Rúbrica principal";

  /*
   * Con qué criterios nace. Una maratón de Clickatón no configura nada: sus
   * cuatro criterios y la escala están en las bases. El resto sigue como
   * estaba, incluida la rúbrica vacía en producción para un concurso ajeno.
   */
  const criteriosIniciales = criteriosParaConcurso({
    slug: contest?.slug ?? null,
    distributionChannel: contest?.distributionChannel ?? null,
    esProduccion: process.env.NODE_ENV === "production" && !input.localExample,
  });

  const maxVersion = await db.fotorankJuryRubric.aggregate({
    where: { contestId: input.contestId, name: rubricName },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  if (!criteriosIniciales) {
    // En prod no inventar criterios definitivos para un concurso ajeno.
    const empty = await db.fotorankJuryRubric.create({
      data: {
        id: newId(),
        contestId: input.contestId,
        admissionBatchId: input.admissionBatchId,
        version: nextVersion,
        name: rubricName,
        description: "Borrador — configurar criterios antes de activar.",
        status: "DRAFT",
        scoringMode: "WEIGHTED_SCORE",
        createdByUserId: input.actorUserId,
      },
      include: { criteria: true },
    });
    return empty;
  }

  const criteria = criteriosIniciales.map((c) => ({ id: newId(), ...c }));

  const rubric = await db.fotorankJuryRubric.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      version: nextVersion,
      name: rubricName,
      description: esDeClickaton
        ? "Los cuatro criterios de las bases de Clickatón, del 1 al 10 y con el mismo peso."
        : isSantaFe
          ? "PENDING_ORGANIZER_DECISION · BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR"
          : "Fixture local — no usar como reglamento definitivo.",
      status: "DRAFT",
      scoringMode: "WEIGHTED_SCORE",
      createdByUserId: input.actorUserId,
      criteria: { create: criteria },
    },
    include: { criteria: true },
  });
  return rubric;
}

/**
 * Elegir el tipo de calificación: rehace los criterios de la rúbrica en borrador.
 *
 * Sólo mientras la rúbrica no esté activa y nadie haya enviado una nota: cambiar
 * el tipo con notas enviadas mezclaría escalas en el mismo ranking.
 */
export async function configurarTipoDeCalificacion(input: {
  contestId: string;
  sessionId: string;
  config: ConfiguracionDeCalificacion;
  actorUserId: number;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const session = await db.fotorankJuryScoringSession.findFirst({
    where: { id: input.sessionId, contestId: input.contestId },
    include: { rubric: true },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión no encontrada.", 404);
  if (session.rubric.status !== "DRAFT") {
    throw new JuryError(
      "RUBRIC_IMMUTABLE",
      "La rúbrica ya está activa: el tipo de calificación no se puede cambiar.",
      409,
    );
  }
  const enviadas = await db.fotorankJuryEvaluation.count({
    where: { rubricId: session.rubricId, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  if (enviadas > 0) {
    throw new JuryError("RUBRIC_IMMUTABLE", "Ya hay notas enviadas con esta rúbrica.", 409);
  }

  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true, distributionChannel: true, rulesData: true },
  });
  const criteriosDelConcurso =
    criteriosDesdeLasReglas(contest?.rulesData) ??
    criteriosParaConcurso({
      slug: contest?.slug ?? null,
      distributionChannel: contest?.distributionChannel ?? null,
      esProduccion: process.env.NODE_ENV === "production",
    });
  const rubrica = rubricaParaTipo(input.config, criteriosDelConcurso);
  if (!rubrica) {
    throw new JuryError(
      "RUBRIC_EMPTY",
      "El concurso no tiene criterios cargados. Cargalos en Jurado → Evaluación o elegí otro tipo.",
      409,
    );
  }

  const metadataPrevia =
    session.metadata && typeof session.metadata === "object"
      ? (session.metadata as Record<string, unknown>)
      : {};
  const { cupoDeSeleccion: _anterior, ...resto } = metadataPrevia;
  void _anterior;

  await db.$transaction([
    db.fotorankJuryCriterion.deleteMany({ where: { rubricId: session.rubricId } }),
    db.fotorankJuryRubric.update({
      where: { id: session.rubricId },
      data: {
        scoringMode: rubrica.modo,
        description: etiquetaDelTipo(input.config),
        criteria: { create: rubrica.criterios.map((c) => ({ id: newId(), ...c })) },
      },
    }),
    db.fotorankJuryScoringSession.update({
      where: { id: session.id },
      data: {
        metadata: (input.config.tipo === "SELECCION_CON_CUPO"
          ? { ...resto, cupoDeSeleccion: input.config.cupo }
          : resto) as object,
        scoreScaleMin: Math.min(...rubrica.criterios.map((c) => c.minScore)),
        scoreScaleMax: Math.max(...rubrica.criterios.map((c) => c.maxScore)),
      },
    }),
  ]);

  await writeSessionAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_SCORING_TYPE_CONFIGURED",
    entityId: session.id,
    payload: { tipo: input.config.tipo, etiqueta: etiquetaDelTipo(input.config) },
  });
}

export async function activateRubric(input: {
  contestId: string;
  rubricId: string;
  actorUserId: number;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const rubric = await db.fotorankJuryRubric.findFirst({
    where: { id: input.rubricId, contestId: input.contestId },
    include: { criteria: true },
  });
  if (!rubric) throw new JuryError("RUBRIC_NOT_FOUND", "Rúbrica no encontrada.", 404);
  if (rubric.criteria.length === 0) {
    throw new JuryError("RUBRIC_EMPTY", "La rúbrica no tiene criterios.", 409);
  }

  const submitted = await db.fotorankJuryEvaluation.count({
    where: {
      contestId: input.contestId,
      rubricId: rubric.id,
      status: { in: ["SUBMITTED", "LOCKED"] },
    },
  });
  if (submitted > 0 && rubric.status === "ACTIVE") {
    throw new JuryError(
      "RUBRIC_IMMUTABLE",
      "Hay evaluaciones enviadas; creá una nueva versión.",
      409,
    );
  }

  await db.fotorankJuryRubric.updateMany({
    where: {
      contestId: input.contestId,
      admissionBatchId: rubric.admissionBatchId,
      status: "ACTIVE",
      id: { not: rubric.id },
    },
    data: { status: "SUPERSEDED" },
  });

  const updated = await db.fotorankJuryRubric.update({
    where: { id: rubric.id },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
      activatedByUserId: input.actorUserId,
      criteriaSnapshot: rubric.criteria.map((c) => ({
        key: c.key,
        name: c.name,
        weight: c.weight,
        minScore: c.minScore,
        maxScore: c.maxScore,
        step: c.step,
        required: c.required,
      })),
    },
    include: { criteria: true },
  });
  await writeSessionAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_RUBRIC_ACTIVATED",
    entityId: updated.id,
    payload: { version: updated.version, name: updated.name },
  });
  return updated;
}

export async function ensureDraftScoringSession(input: {
  contestId: string;
  admissionBatchId: string;
  actorUserId: number;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const batch = await db.fotorankAdmissionBatch.findFirst({
    where: { id: input.admissionBatchId, contestId: input.contestId },
  });
  if (!batch) throw new JuryError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);
  if (batch.status !== "FROZEN") {
    throw new JuryError("BATCH_NOT_FROZEN", "Solo se puede crear sesión sobre batch FROZEN.", 409);
  }

  const existing = await db.fotorankJuryScoringSession.findFirst({
    where: {
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      status: { in: ["DRAFT", "READY", "OPEN", "PAUSED", "REVIEW_REQUIRED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const contest = await db.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true, distributionChannel: true },
  });
  const isSantaFe = contest?.slug === "santa-fe-en-foco";
  const esDeClickaton = contest?.distributionChannel === "CLICKATON";

  /*
   * Cuántos jurados miran cada obra. Sale de cuántos jurados hay: tres
   * cuando el equipo alcanza, todos cuando es más chico. Fijarlo en uno
   * dejaba pasar obras con una sola mirada y sin nada que desempatar.
   */
  const juradosAsignados = await db.fotorankJudgeAssignment.count({
    where: { contestId: input.contestId },
  });

  const rubric = await ensureDraftRubric({
    contestId: input.contestId,
    admissionBatchId: input.admissionBatchId,
    actorUserId: input.actorUserId,
    localExample: process.env.NODE_ENV !== "production" || isSantaFe,
  });

  return db.fotorankJuryScoringSession.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      rubricId: rubric.id,
      status: "DRAFT",
      scoringEnabled: false,
      minimumEvaluationsPerEntry:
        isSantaFe || esDeClickaton
          ? minimoDeEvaluacionesPorObra(juradosAsignados)
          : 1,
      assignmentSeed: randomBytes(16).toString("hex"),
    },
  });
}

export async function openScoringSession(input: {
  contestId: string;
  sessionId: string;
  actorUserId: number;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const session = await db.fotorankJuryScoringSession.findFirst({
    where: { id: input.sessionId, contestId: input.contestId },
    include: {
      admissionBatch: true,
      rubric: { include: { criteria: true } },
    },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión no encontrada.", 404);
  if (session.admissionBatch.status !== "FROZEN") {
    throw new JuryError("BATCH_NOT_FROZEN", "Batch no congelado.", 409);
  }
  if (session.rubric.status !== "ACTIVE") {
    throw new JuryError("RUBRIC_NOT_ACTIVE", "Activá la rúbrica antes de abrir.", 409);
  }
  if (session.rubric.criteria.length === 0) {
    throw new JuryError("RUBRIC_EMPTY", "Rúbrica sin criterios.", 409);
  }

  const opened = await db.fotorankJuryScoringSession.update({
    where: { id: session.id },
    data: {
      status: "OPEN",
      scoringEnabled: true,
      openedAt: new Date(),
      openedByUserId: input.actorUserId,
      opensAt: session.opensAt ?? new Date(),
    },
  });
  await writeSessionAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_SESSION_OPENED",
    entityId: opened.id,
    payload: { admissionBatchId: session.admissionBatchId, rubricId: session.rubricId },
  });
  await enqueueJuryNotificationIntent({
    contestId: input.contestId,
    kind: "JURY_SCORING_OPEN",
    admissionBatchId: session.admissionBatchId,
    scoringSessionId: opened.id,
  });
  return opened;
}

export async function closeScoringSession(input: {
  contestId: string;
  sessionId: string;
  actorUserId: number;
  force?: boolean;
  reason?: string | null;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const session = await db.fotorankJuryScoringSession.findFirst({
    where: { id: input.sessionId, contestId: input.contestId },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión no encontrada.", 404);

  const coverage = await getCoverageReport(input.contestId, session.id);
  if (coverage.incompleteEntries > 0 && !input.force) {
    throw new JuryError(
      "COVERAGE_INCOMPLETE",
      `Hay ${coverage.incompleteEntries} obras bajo el mínimo de evaluaciones.`,
      409,
    );
  }
  if (coverage.activeConflicts > 0 && !input.force) {
    throw new JuryError("CONFLICTS_OPEN", "Hay conflictos sin resolver.", 409);
  }

  await computeAndStorePreliminaryAggregates({
    contestId: input.contestId,
    sessionId: session.id,
  });

  const closed = await db.fotorankJuryScoringSession.update({
    where: { id: session.id },
    data: {
      status: "CLOSED",
      scoringEnabled: false,
      closedAt: new Date(),
      closedByUserId: input.actorUserId,
      submittedEvaluationsCount: coverage.submittedEvaluations,
      incompleteEntriesCount: coverage.incompleteEntries,
      metadata: {
        force: Boolean(input.force),
        reason: input.reason ?? null,
        coverage,
      },
    },
  });
  await writeSessionAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: input.force ? "JURY_SESSION_CLOSED_FORCED" : "JURY_SESSION_CLOSED",
    entityId: closed.id,
    payload: {
      force: Boolean(input.force),
      reason: input.reason ?? null,
      coverage,
    },
  });
  await enqueueJuryNotificationIntent({
    contestId: input.contestId,
    kind: "JURY_SESSION_CLOSED",
    scoringSessionId: closed.id,
    metadata: { force: Boolean(input.force) },
  });
  return closed;
}

export async function getCoverageReport(contestId: string, sessionId: string) {
  const { db } = await baseDelConcurso(contestId);
  const session = await db.fotorankJuryScoringSession.findFirstOrThrow({
    where: { id: sessionId, contestId },
  });
  const snapshots = await db.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
    select: { id: true, anonymousCode: true, entryId: true },
  });
  const submitted = await db.fotorankJuryEvaluation.groupBy({
    by: ["juryEntrySnapshotId"],
    where: {
      scoringSessionId: sessionId,
      status: { in: ["SUBMITTED", "LOCKED"] },
    },
    _count: { _all: true },
  });
  const bySnap = new Map(submitted.map((s) => [s.juryEntrySnapshotId, s._count._all]));
  let incomplete = 0;
  let complete = 0;
  for (const snap of snapshots) {
    const n = bySnap.get(snap.id) ?? 0;
    if (n >= session.minimumEvaluationsPerEntry) complete += 1;
    else incomplete += 1;
  }
  const activeConflicts = await db.fotorankJudgeEntryConflict.count({
    where: {
      contestId,
      status: "ACTIVE",
      entryId: { in: snapshots.map((s) => s.entryId) },
    },
  });
  const submittedEvaluations = await db.fotorankJuryEvaluation.count({
    where: { scoringSessionId: sessionId, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  return {
    totalEntries: snapshots.length,
    completeEntries: complete,
    incompleteEntries: incomplete,
    submittedEvaluations,
    activeConflicts,
    minimumPerEntry: session.minimumEvaluationsPerEntry,
  };
}

export async function computeAndStorePreliminaryAggregates(input: {
  contestId: string;
  sessionId: string;
}) {
  const { db } = await baseDelConcurso(input.contestId);
  const session = await db.fotorankJuryScoringSession.findFirstOrThrow({
    where: { id: input.sessionId, contestId: input.contestId },
  });
  const snapshots = await db.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
  });

  for (const snap of snapshots) {
    const evals = await db.fotorankJuryEvaluation.findMany({
      where: {
        scoringSessionId: session.id,
        juryEntrySnapshotId: snap.id,
        status: { in: ["SUBMITTED", "LOCKED"] },
      },
      select: { totalScore: true, normalizedScore: true },
    });
    const totals = evals
      .map((e) => e.totalScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const norms = evals
      .map((e) => e.normalizedScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const agg = computePrivateAggregates(totals);
    const normAgg = computePrivateAggregates(norms);

    await db.fotorankJuryPreliminaryAggregate.upsert({
      where: {
        scoringSessionId_juryEntrySnapshotId: {
          scoringSessionId: session.id,
          juryEntrySnapshotId: snap.id,
        },
      },
      create: {
        id: newId(),
        contestId: input.contestId,
        admissionBatchId: session.admissionBatchId,
        scoringSessionId: session.id,
        juryEntrySnapshotId: snap.id,
        anonymousCode: snap.anonymousCode,
        evaluationCount: agg.count,
        averageScore: agg.average,
        medianScore: agg.median,
        normalizedAverage: normAgg.average,
        minScore: agg.min,
        maxScore: agg.max,
        stdDev: agg.stdDev,
        coverageComplete: agg.count >= session.minimumEvaluationsPerEntry,
      },
      update: {
        evaluationCount: agg.count,
        averageScore: agg.average,
        medianScore: agg.median,
        normalizedAverage: normAgg.average,
        minScore: agg.min,
        maxScore: agg.max,
        stdDev: agg.stdDev,
        coverageComplete: agg.count >= session.minimumEvaluationsPerEntry,
        computedAt: new Date(),
      },
    });
  }
}

export async function exportJuryProgressCsv(contestId: string, sessionId: string) {
  const { db } = await baseDelConcurso(contestId);
  const coverage = await getCoverageReport(contestId, sessionId);
  const evals = await db.fotorankJuryEvaluation.findMany({
    where: { contestId, scoringSessionId: sessionId },
    include: {
      juryEntrySnapshot: { select: { anonymousCode: true } },
      juror: { select: { email: true } },
    },
    orderBy: { updatedAt: "asc" },
  });
  const header = ["jurado", "codigo_anonimo", "estado", "total", "enviado_at"].join(",");
  const lines = evals.map((e) =>
    [
      e.juror.email,
      e.juryEntrySnapshot.anonymousCode,
      e.status,
      e.totalScore ?? "",
      e.submittedAt?.toISOString() ?? "",
    ].join(","),
  );
  return {
    csv: [header, ...lines].join("\n"),
    coverage,
  };
}

export async function exportBlindAggregatesCsv(contestId: string, sessionId: string) {
  const { db } = await baseDelConcurso(contestId);
  const rows = await db.fotorankJuryPreliminaryAggregate.findMany({
    where: { contestId, scoringSessionId: sessionId },
    orderBy: { anonymousCode: "asc" },
  });
  const header = [
    "codigo_anonimo",
    "evaluaciones",
    "promedio",
    "mediana",
    "normalizado",
    "cobertura",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.anonymousCode,
      r.evaluationCount,
      r.averageScore ?? "",
      r.medianScore ?? "",
      r.normalizedAverage ?? "",
      r.coverageComplete ? "SI" : "NO",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

/** Export administrativo de evaluaciones (requiere canExportJuryScores). Sin identidad de participante. */
export async function exportAdminEvaluationsCsv(contestId: string, sessionId: string) {
  const { db } = await baseDelConcurso(contestId);
  const evals = await db.fotorankJuryEvaluation.findMany({
    where: { contestId, scoringSessionId: sessionId },
    include: {
      juryEntrySnapshot: {
        select: {
          anonymousCode: true,
          categoryId: true,
          promptExternalId: true,
        },
      },
      juror: { select: { email: true } },
      criterionScores: {
        orderBy: { criterionKeySnapshot: "asc" },
        select: {
          criterionKeySnapshot: true,
          criterionNameSnapshot: true,
          score: true,
          weightSnapshot: true,
          weightedScore: true,
        },
      },
    },
    orderBy: [
      { juryEntrySnapshot: { anonymousCode: "asc" } },
      { juror: { email: "asc" } },
    ],
  });

  const header = [
    "codigo_anonimo",
    "categoria_id",
    "consigna_id",
    "jurado",
    "estado",
    "total",
    "normalizado",
    "rubric_version",
    "enviado_at",
    "criterios_json",
  ].join(",");

  const lines = evals.map((e) => {
    const criteria = JSON.stringify(
      e.criterionScores.map((c) => ({
        key: c.criterionKeySnapshot,
        name: c.criterionNameSnapshot,
        score: c.score,
        weight: c.weightSnapshot,
        weighted: c.weightedScore,
      })),
    ).replace(/"/g, '""');
    return [
      e.juryEntrySnapshot.anonymousCode,
      e.juryEntrySnapshot.categoryId,
      e.juryEntrySnapshot.promptExternalId ?? "",
      e.juror.email,
      e.status,
      e.totalScore ?? "",
      e.normalizedScore ?? "",
      e.rubricVersion,
      e.submittedAt?.toISOString() ?? "",
      `"${criteria}"`,
    ].join(",");
  });

  return [header, ...lines].join("\n");
}
