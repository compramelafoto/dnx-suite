import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { enqueueJuryNotificationIntent } from "./notification-intents";
import { computePrivateAggregates } from "./scoring-engine";
import {
  SANTA_FE_EN_FOCO_JURY_CRITERIA,
  SANTA_FE_MIN_EVALUATIONS_PER_ENTRY,
} from "./santa-fe-en-foco-rubric";

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
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;
  await prisma.fotorankJudgeAuditEvent.create({
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

const EXAMPLE_CRITERIA = [
  { key: "interpretation", name: "Interpretación de la consigna", weight: 30, sortOrder: 10 },
  { key: "creativity", name: "Creatividad", weight: 25, sortOrder: 20 },
  { key: "composition", name: "Composición", weight: 20, sortOrder: 30 },
  { key: "impact", name: "Impacto visual", weight: 15, sortOrder: 40 },
  { key: "technique", name: "Técnica", weight: 10, sortOrder: 50 },
] as const;

export async function ensureDraftRubric(input: {
  contestId: string;
  admissionBatchId: string;
  actorUserId: number;
  localExample?: boolean;
}) {
  const existing = await prisma.fotorankJuryRubric.findFirst({
    where: { contestId: input.contestId, admissionBatchId: input.admissionBatchId },
    orderBy: { version: "desc" },
    include: { criteria: true },
  });
  if (existing) return existing;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true },
  });
  const isSantaFe = contest?.slug === "santa-fe-en-foco";
  const rubricName = isSantaFe
    ? "Santa Fe en Foco — rúbrica staging (borrador legal)"
    : input.localExample || process.env.NODE_ENV !== "production"
      ? "Rúbrica ejemplo (local)"
      : "Rúbrica principal";

  const maxVersion = await prisma.fotorankJuryRubric.aggregate({
    where: { contestId: input.contestId, name: rubricName },
    _max: { version: true },
  });
  const nextVersion = (maxVersion._max.version ?? 0) + 1;

  if (!input.localExample && !isSantaFe && process.env.NODE_ENV === "production") {
    // En prod no inventar criterios definitivos (salvo plantilla staging Santa Fe).
    const empty = await prisma.fotorankJuryRubric.create({
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

  const criteria = isSantaFe
    ? SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
        id: newId(),
        key: c.key,
        name: c.name,
        description: c.description,
        weight: c.weight,
        minScore: c.minScore,
        maxScore: c.maxScore,
        step: c.step,
        required: c.required,
        sortOrder: c.sortOrder,
      }))
    : EXAMPLE_CRITERIA.map((c) => ({
        id: newId(),
        key: c.key,
        name: c.name,
        description: null as string | null,
        weight: c.weight,
        minScore: 1,
        maxScore: 10,
        step: 1,
        required: true,
        sortOrder: c.sortOrder,
      }));

  const rubric = await prisma.fotorankJuryRubric.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      version: nextVersion,
      name: rubricName,
      description: isSantaFe
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

export async function activateRubric(input: {
  contestId: string;
  rubricId: string;
  actorUserId: number;
}) {
  const rubric = await prisma.fotorankJuryRubric.findFirst({
    where: { id: input.rubricId, contestId: input.contestId },
    include: { criteria: true },
  });
  if (!rubric) throw new JuryError("RUBRIC_NOT_FOUND", "Rúbrica no encontrada.", 404);
  if (rubric.criteria.length === 0) {
    throw new JuryError("RUBRIC_EMPTY", "La rúbrica no tiene criterios.", 409);
  }

  const submitted = await prisma.fotorankJuryEvaluation.count({
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

  await prisma.fotorankJuryRubric.updateMany({
    where: {
      contestId: input.contestId,
      admissionBatchId: rubric.admissionBatchId,
      status: "ACTIVE",
      id: { not: rubric.id },
    },
    data: { status: "SUPERSEDED" },
  });

  const updated = await prisma.fotorankJuryRubric.update({
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
  const batch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { id: input.admissionBatchId, contestId: input.contestId },
  });
  if (!batch) throw new JuryError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);
  if (batch.status !== "FROZEN") {
    throw new JuryError("BATCH_NOT_FROZEN", "Solo se puede crear sesión sobre batch FROZEN.", 409);
  }

  const existing = await prisma.fotorankJuryScoringSession.findFirst({
    where: {
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      status: { in: ["DRAFT", "READY", "OPEN", "PAUSED", "REVIEW_REQUIRED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true },
  });
  const isSantaFe = contest?.slug === "santa-fe-en-foco";

  const rubric = await ensureDraftRubric({
    contestId: input.contestId,
    admissionBatchId: input.admissionBatchId,
    actorUserId: input.actorUserId,
    localExample: process.env.NODE_ENV !== "production" || isSantaFe,
  });

  return prisma.fotorankJuryScoringSession.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      rubricId: rubric.id,
      status: "DRAFT",
      scoringEnabled: false,
      minimumEvaluationsPerEntry: isSantaFe ? SANTA_FE_MIN_EVALUATIONS_PER_ENTRY : 1,
      assignmentSeed: randomBytes(16).toString("hex"),
    },
  });
}

export async function openScoringSession(input: {
  contestId: string;
  sessionId: string;
  actorUserId: number;
}) {
  const session = await prisma.fotorankJuryScoringSession.findFirst({
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

  const opened = await prisma.fotorankJuryScoringSession.update({
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
  const session = await prisma.fotorankJuryScoringSession.findFirst({
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

  const closed = await prisma.fotorankJuryScoringSession.update({
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
  const session = await prisma.fotorankJuryScoringSession.findFirstOrThrow({
    where: { id: sessionId, contestId },
  });
  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
    select: { id: true, anonymousCode: true, entryId: true },
  });
  const submitted = await prisma.fotorankJuryEvaluation.groupBy({
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
  const activeConflicts = await prisma.fotorankJudgeEntryConflict.count({
    where: {
      contestId,
      status: "ACTIVE",
      entryId: { in: snapshots.map((s) => s.entryId) },
    },
  });
  const submittedEvaluations = await prisma.fotorankJuryEvaluation.count({
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
  const session = await prisma.fotorankJuryScoringSession.findFirstOrThrow({
    where: { id: input.sessionId, contestId: input.contestId },
  });
  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
  });

  for (const snap of snapshots) {
    const evals = await prisma.fotorankJuryEvaluation.findMany({
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

    await prisma.fotorankJuryPreliminaryAggregate.upsert({
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
  const coverage = await getCoverageReport(contestId, sessionId);
  const evals = await prisma.fotorankJuryEvaluation.findMany({
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
  const rows = await prisma.fotorankJuryPreliminaryAggregate.findMany({
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
  const evals = await prisma.fotorankJuryEvaluation.findMany({
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
