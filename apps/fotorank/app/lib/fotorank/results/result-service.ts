import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { ResultError } from "./errors";
import { enqueueResultNotificationIntent } from "./notification-intents";
import {
  assignPreliminaryAwards,
  computeRanking,
  RANKING_ENGINE_VERSION,
  type RankingScope,
} from "./ranking-engine";
import { assertCanEnqueueResultsSocialPublish } from "./social-publication-gate";

function newId() {
  return `rb${randomBytes(12).toString("hex")}`;
}

async function writeAudit(input: {
  contestId: string;
  actorUserId: number;
  eventType: string;
  entityType: string;
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
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}

export async function ensureDraftResultRuleSet(input: {
  contestId: string;
  scoringSessionId: string;
  actorUserId: number;
}) {
  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { id: input.scoringSessionId, contestId: input.contestId },
  });
  if (!session) throw new ResultError("SESSION_NOT_CLOSED", "Sesión no encontrada.", 404);

  const existing = await prisma.fotorankResultRuleSet.findFirst({
    where: {
      contestId: input.contestId,
      scoringSessionId: input.scoringSessionId,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    orderBy: { version: "desc" },
  });
  if (existing) return existing;

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { slug: true },
  });
  const isSantaFe = contest?.slug === "santa-fe-en-foco";
  const name = isSantaFe
    ? "Santa Fe en Foco — ranking privado (borrador legal)"
    : "Reglas de resultados";
  const maxVersion = await prisma.fotorankResultRuleSet.aggregate({
    where: { contestId: input.contestId, name },
    _max: { version: true },
  });
  const version = (maxVersion._max.version ?? 0) + 1;

  const created = await prisma.fotorankResultRuleSet.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
      scoringSessionId: session.id,
      version,
      name,
      status: "DRAFT",
      aggregationMethod: "WEIGHTED_AVERAGE",
      tieBreakStrategy: "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION",
      minimumValidEvaluations: session.minimumEvaluationsPerEntry,
      discardHighestScore: false,
      discardLowestScore: false,
      rankingEnabled: false,
      priorityCriterionKey: isSantaFe ? "narrative_impact" : null,
      createdByUserId: input.actorUserId,
    },
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_RULESET_CREATED",
    entityType: "FotorankResultRuleSet",
    entityId: created.id,
    payload: { version, rankingEnabled: false },
  });
  return created;
}

export async function activateResultRuleSet(input: {
  contestId: string;
  ruleSetId: string;
  actorUserId: number;
}) {
  const ruleSet = await prisma.fotorankResultRuleSet.findFirst({
    where: { id: input.ruleSetId, contestId: input.contestId },
  });
  if (!ruleSet) throw new ResultError("RULESET_NOT_FOUND", "Ruleset no encontrado.", 404);

  await prisma.fotorankResultRuleSet.updateMany({
    where: {
      contestId: input.contestId,
      scoringSessionId: ruleSet.scoringSessionId,
      status: "ACTIVE",
      id: { not: ruleSet.id },
    },
    data: { status: "SUPERSEDED" },
  });

  const updated = await prisma.fotorankResultRuleSet.update({
    where: { id: ruleSet.id },
    data: {
      status: "ACTIVE",
      activatedAt: new Date(),
      activatedByUserId: input.actorUserId,
    },
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_RULESET_ACTIVATED",
    entityType: "FotorankResultRuleSet",
    entityId: updated.id,
    payload: { version: updated.version },
  });
  return updated;
}

async function loadRankingInputs(contestId: string, scoringSessionId: string) {
  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { id: scoringSessionId, contestId },
  });
  if (!session) throw new ResultError("SESSION_NOT_CLOSED", "Sesión no encontrada.", 404);
  if (session.status !== "CLOSED" && session.status !== "LOCKED") {
    throw new ResultError(
      "SESSION_OPEN",
      "Solo se puede rankear con sesión de jurado CLOSED.",
      409,
    );
  }

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId },
    include: {
      entry: { select: { status: true, admissionStatus: true } },
    },
  });

  const evaluations = await prisma.fotorankJuryEvaluation.findMany({
    where: {
      scoringSessionId: session.id,
      status: { in: ["SUBMITTED", "LOCKED", "IN_PROGRESS", "VOIDED"] },
    },
    include: {
      criterionScores: true,
    },
  });

  return { session, snapshots, evaluations };
}

export async function generateResultBatch(input: {
  contestId: string;
  scoringSessionId: string;
  ruleSetId: string;
  actorUserId: number;
  scope?: RankingScope;
  idempotencyKey?: string | null;
  forceIncomplete?: boolean;
}) {
  if (input.idempotencyKey) {
    const replay = await prisma.fotorankResultBatch.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { entries: true },
    });
    if (replay) return { batch: replay, idempotent: true as const };
  }

  const ruleSet = await prisma.fotorankResultRuleSet.findFirst({
    where: { id: input.ruleSetId, contestId: input.contestId },
  });
  if (!ruleSet) throw new ResultError("RULESET_NOT_FOUND", "Ruleset no encontrado.", 404);
  if (ruleSet.status !== "ACTIVE" && ruleSet.status !== "DRAFT") {
    throw new ResultError("RULESET_NOT_ACTIVE", "Ruleset no usable.", 409);
  }

  const { session, snapshots, evaluations } = await loadRankingInputs(
    input.contestId,
    input.scoringSessionId,
  );

  const priorityKey = ruleSet.priorityCriterionKey;
  const evalInputs = evaluations.map((e) => {
    const priority =
      priorityKey != null
        ? e.criterionScores.find((c) => c.criterionKeySnapshot === priorityKey)?.score ?? null
        : null;
    return {
      snapshotId: e.juryEntrySnapshotId,
      anonymousCode: snapshots.find((s) => s.id === e.juryEntrySnapshotId)?.anonymousCode ?? "",
      categoryId: snapshots.find((s) => s.id === e.juryEntrySnapshotId)?.categoryId ?? "",
      promptExternalId:
        snapshots.find((s) => s.id === e.juryEntrySnapshotId)?.promptExternalId ?? null,
      totalScore: e.totalScore ?? 0,
      normalizedScore: e.normalizedScore ?? 0,
      priorityCriterionScore: priority,
      status: e.status as "SUBMITTED" | "LOCKED" | "IN_PROGRESS" | "VOIDED" | "NOT_STARTED",
    };
  });

  const entryMetas = snapshots.map((s) => ({
    snapshotId: s.id,
    anonymousCode: s.anonymousCode,
    categoryId: s.categoryId,
    promptExternalId: s.promptExternalId,
    admissionStatus: s.entry.admissionStatus ?? "NOT_EVALUATED",
    entryStatus: s.entry.status,
  }));

  const scope = input.scope ?? "CATEGORY_AND_PROMPT";
  const { works } = computeRanking({
    entries: entryMetas,
    evaluations: evalInputs,
    rules: {
      aggregationMethod: ruleSet.aggregationMethod,
      tieBreakStrategy: ruleSet.tieBreakStrategy,
      minimumValidEvaluations: ruleSet.minimumValidEvaluations,
      discardHighestScore: ruleSet.discardHighestScore,
      discardLowestScore: ruleSet.discardLowestScore,
      priorityCriterionKey: ruleSet.priorityCriterionKey,
      ruleSetVersion: ruleSet.version,
      winnersPerScope: ruleSet.winnersPerScope,
    },
    scope,
  });

  const withAwards = assignPreliminaryAwards(works, ruleSet.winnersPerScope);
  const incomplete = withAwards.filter((w) => w.coverageStatus === "INCOMPLETE").length;
  const ties = withAwards.filter((w) => w.flags.includes("MANUAL_TIEBREAK_REQUIRED")).length;

  let status: "GENERATED" | "REVIEW_REQUIRED" | "READY_TO_FINALIZE" = "GENERATED";
  if (incomplete > 0 || ties > 0) status = "REVIEW_REQUIRED";
  else status = "READY_TO_FINALIZE";

  // Cancelar DRAFT/GENERATED previos no finalizados (regeneración)
  await prisma.fotorankResultBatch.updateMany({
    where: {
      contestId: input.contestId,
      scoringSessionId: session.id,
      status: { in: ["DRAFT", "GENERATED", "REVIEW_REQUIRED", "READY_TO_FINALIZE"] },
    },
    data: { status: "CANCELLED" },
  });

  const batch = await prisma.fotorankResultBatch.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
      scoringSessionId: session.id,
      ruleSetId: ruleSet.id,
      status,
      scope,
      generatedAt: new Date(),
      generatedByUserId: input.actorUserId,
      engineVersion: RANKING_ENGINE_VERSION,
      ruleSetVersion: ruleSet.version,
      idempotencyKey: input.idempotencyKey ?? null,
      metadata: {
        incomplete,
        ties,
        forceIncomplete: Boolean(input.forceIncomplete),
        live: false,
        published: false,
      },
      entries: {
        create: withAwards.map((w) => ({
          id: newId(),
          juryEntrySnapshotId: w.snapshotId,
          anonymousCode: w.anonymousCode,
          categoryId: w.categoryId,
          promptExternalId: w.promptExternalId,
          scopeKey: w.scopeKey,
          aggregateScore: w.aggregateScore,
          normalizedScore: w.normalizedScore,
          medianScore: w.medianScore,
          dispersion: w.dispersion,
          evaluationCount: w.evaluationCount,
          coverageStatus: w.coverageStatus,
          preliminaryPosition: w.preliminaryPosition,
          tieGroup: w.tieGroup,
          resultStatus: w.resultStatus,
          awardType: w.awardType,
          flagsJson: w.flags,
        })),
      },
    },
    include: { entries: true },
  });

  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_BATCH_GENERATED",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { status, incomplete, ties, engineVersion: RANKING_ENGINE_VERSION },
  });

  await enqueueResultNotificationIntent({
    contestId: input.contestId,
    kind: ties > 0 ? "RESULTS_TIE_PENDING" : "RESULTS_READY_FOR_REVIEW",
    resultBatchId: batch.id,
  });

  return { batch, idempotent: false as const };
}

export async function markResultBatchReviewed(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
}) {
  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { id: input.batchId, contestId: input.contestId },
    include: { entries: true },
  });
  if (!batch) throw new ResultError("BATCH_NOT_FOUND", "Batch no encontrado.", 404);
  if (batch.status === "FINALIZED" || batch.status === "PUBLISHED") {
    throw new ResultError("BATCH_IMMUTABLE", "Batch finalizado inmutable.", 409);
  }

  const openTies = batch.entries.filter(
    (e) => e.resultStatus === "TIED" && e.finalPosition == null,
  ).length;
  const incomplete = batch.entries.filter((e) => e.coverageStatus === "INCOMPLETE").length;

  const next =
    openTies === 0 && incomplete === 0 ? "READY_TO_FINALIZE" : "REVIEW_REQUIRED";

  const updated = await prisma.fotorankResultBatch.update({
    where: { id: batch.id },
    data: {
      status: next,
      reviewedAt: new Date(),
      reviewedByUserId: input.actorUserId,
    },
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_BATCH_REVIEWED",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { status: next, openTies, incomplete },
  });
  return updated;
}

export async function createTieBreakSessionDraft(input: {
  contestId: string;
  batchId: string;
  tieGroup: string;
  actorUserId: number;
}) {
  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { id: input.batchId, contestId: input.contestId },
  });
  if (!batch) throw new ResultError("BATCH_NOT_FOUND", "Batch no encontrado.", 404);
  if (batch.status === "FINALIZED" || batch.status === "PUBLISHED") {
    throw new ResultError("BATCH_IMMUTABLE", "Batch inmutable.", 409);
  }

  const session = await prisma.fotorankTieBreakSession.create({
    data: {
      id: newId(),
      contestId: input.contestId,
      resultBatchId: batch.id,
      tieGroup: input.tieGroup,
      status: "DRAFT",
      strategy: "ORDINAL_VOTE",
      createdByUserId: input.actorUserId,
    },
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_TIEBREAK_CREATED",
    entityType: "FotorankTieBreakSession",
    entityId: session.id,
    payload: { tieGroup: input.tieGroup, autoOpen: false },
  });
  return session;
}

export async function resolveTieManual(input: {
  contestId: string;
  batchId: string;
  orderedSnapshotIds: string[];
  tieGroup: string;
  actorUserId: number;
  note?: string | null;
}) {
  if (!input.note?.trim()) {
    throw new ResultError("REASON_REQUIRED", "Motivo de desempate obligatorio.", 400);
  }
  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { id: input.batchId, contestId: input.contestId },
    include: { entries: true },
  });
  if (!batch) throw new ResultError("BATCH_NOT_FOUND", "Batch no encontrado.", 404);
  if (batch.status === "FINALIZED" || batch.status === "PUBLISHED") {
    throw new ResultError("BATCH_IMMUTABLE", "Batch inmutable.", 409);
  }

  const tied = batch.entries
    .filter((e) => e.tieGroup === input.tieGroup)
    .sort((a, b) => (a.preliminaryPosition ?? 0) - (b.preliminaryPosition ?? 0));
  const basePos = tied[0]?.preliminaryPosition ?? 1;

  for (let i = 0; i < input.orderedSnapshotIds.length; i++) {
    const snapId = input.orderedSnapshotIds[i]!;
    const entry = tied.find((e) => e.juryEntrySnapshotId === snapId);
    if (!entry) continue;
    await prisma.fotorankResultEntry.update({
      where: { id: entry.id },
      data: {
        finalPosition: basePos + i,
        preliminaryPosition: basePos + i,
        resultStatus: i === 0 ? "WINNER" : "RANKED",
        awardType: i === 0 ? "FIRST_PLACE" : i === 1 ? "SECOND_PLACE" : i === 2 ? "THIRD_PLACE" : null,
        juryDecisionNote: input.note.slice(0, 1000),
        tieGroup: null,
        flagsJson: [],
      },
    });
  }

  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_TIE_RESOLVED_MANUAL",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { tieGroup: input.tieGroup, order: input.orderedSnapshotIds },
  });

  return markResultBatchReviewed({
    contestId: input.contestId,
    batchId: batch.id,
    actorUserId: input.actorUserId,
  });
}

export async function excludeResultEntry(input: {
  contestId: string;
  entryId: string;
  actorUserId: number;
  reasonInternal: string;
  reasonPublic?: string | null;
}) {
  if (!input.reasonInternal.trim()) {
    throw new ResultError("REASON_REQUIRED", "Motivo interno obligatorio.", 400);
  }
  const entry = await prisma.fotorankResultEntry.findFirst({
    where: { id: input.entryId, resultBatch: { contestId: input.contestId } },
    include: { resultBatch: true },
  });
  if (!entry) throw new ResultError("BATCH_NOT_FOUND", "Entrada no encontrada.", 404);
  if (entry.resultBatch.status === "FINALIZED" || entry.resultBatch.status === "PUBLISHED") {
    throw new ResultError("BATCH_IMMUTABLE", "Usá una revisión; batch finalizado.", 409);
  }

  const beforePos = entry.preliminaryPosition;
  await prisma.fotorankResultExclusion.create({
    data: {
      id: newId(),
      resultEntryId: entry.id,
      reasonInternal: input.reasonInternal.slice(0, 1000),
      reasonPublic: input.reasonPublic?.slice(0, 500) ?? null,
      actorUserId: input.actorUserId,
    },
  });
  await prisma.fotorankResultEntry.update({
    where: { id: entry.id },
    data: {
      resultStatus: "DISQUALIFIED",
      awardType: null,
      finalPosition: null,
      flagsJson: ["DISQUALIFIED"],
    },
  });

  // Reasignar posiciones en el mismo scope (obras por encima del descalificado no cambian)
  const siblings = await prisma.fotorankResultEntry.findMany({
    where: {
      resultBatchId: entry.resultBatchId,
      scopeKey: entry.scopeKey,
      resultStatus: { not: "DISQUALIFIED" },
      coverageStatus: "COMPLETE",
    },
    orderBy: [{ preliminaryPosition: "asc" }, { anonymousCode: "asc" }],
  });
  let pos = 1;
  for (const s of siblings) {
    await prisma.fotorankResultEntry.update({
      where: { id: s.id },
      data: { preliminaryPosition: pos, finalPosition: pos },
    });
    pos += 1;
  }

  const revCount = await prisma.fotorankResultRevision.count({
    where: { resultBatchId: entry.resultBatchId },
  });
  await prisma.fotorankResultRevision.create({
    data: {
      id: newId(),
      resultBatchId: entry.resultBatchId,
      revisionNumber: revCount + 1,
      reason: input.reasonInternal.slice(0, 500),
      actorUserId: input.actorUserId,
      beforeJson: { entryId: entry.id, position: beforePos },
      afterJson: { entryId: entry.id, status: "DISQUALIFIED" },
    },
  });

  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_ENTRY_EXCLUDED",
    entityType: "FotorankResultEntry",
    entityId: entry.id,
    payload: { anonymousCode: entry.anonymousCode },
  });
}

export async function finalizeResultBatch(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  force?: boolean;
  reason?: string | null;
}) {
  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { id: input.batchId, contestId: input.contestId },
    include: {
      entries: true,
      scoringSession: true,
      ruleSet: true,
    },
  });
  if (!batch) throw new ResultError("BATCH_NOT_FOUND", "Batch no encontrado.", 404);
  if (batch.status === "FINALIZED" || batch.status === "PUBLISHED") {
    throw new ResultError("BATCH_IMMUTABLE", "Ya finalizado.", 409);
  }
  if (batch.scoringSession.status !== "CLOSED" && batch.scoringSession.status !== "LOCKED") {
    throw new ResultError("SESSION_NOT_CLOSED", "Sesión de jurado no cerrada.", 409);
  }
  if (batch.ruleSet.status !== "ACTIVE" && !input.force) {
    throw new ResultError("RULESET_NOT_ACTIVE", "Activá el ruleset antes de finalizar.", 409);
  }

  const incomplete = batch.entries.filter((e) => e.coverageStatus === "INCOMPLETE").length;
  const ties = batch.entries.filter((e) => e.resultStatus === "TIED").length;
  if ((incomplete > 0 || ties > 0) && !input.force) {
    throw new ResultError(
      incomplete > 0 ? "COVERAGE_INCOMPLETE" : "TIES_UNRESOLVED",
      "Hay cobertura incompleta o empates sin resolver.",
      409,
    );
  }

  // Copiar preliminary → final si falta
  for (const e of batch.entries) {
    if (e.resultStatus === "DISQUALIFIED") continue;
    if (e.finalPosition == null && e.preliminaryPosition != null) {
      await prisma.fotorankResultEntry.update({
        where: { id: e.id },
        data: { finalPosition: e.preliminaryPosition },
      });
    }
  }

  const updated = await prisma.fotorankResultBatch.update({
    where: { id: batch.id },
    data: {
      status: "FINALIZED",
      finalizedAt: new Date(),
      finalizedByUserId: input.actorUserId,
      metadata: {
        ...(typeof batch.metadata === "object" && batch.metadata ? batch.metadata : {}),
        force: Boolean(input.force),
        reason: input.reason ?? null,
        live: false,
        published: false,
      },
    },
  });

  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: input.force ? "RESULT_BATCH_FINALIZED_FORCED" : "RESULT_BATCH_FINALIZED",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { force: Boolean(input.force), reason: input.reason ?? null },
  });

  await enqueueResultNotificationIntent({
    contestId: input.contestId,
    kind: "RESULTS_BATCH_FINALIZED",
    resultBatchId: batch.id,
  });

  // Social gate: nunca encolar en Etapa 15
  assertCanEnqueueResultsSocialPublish({
    batchStatus: "FINALIZED",
    publicationApproved: false,
    resultsReleaseReached: false,
    consentsValid: false,
    liveEnabled: false,
  });

  return updated;
}

/** Resuelve identidad solo con permiso — fuera del ranking anónimo. */
export async function resolveResultIdentity(input: {
  contestId: string;
  anonymousCode: string;
  actorUserId: number;
  hasPermission: boolean;
}) {
  if (!input.hasPermission) {
    throw new ResultError("IDENTITY_FORBIDDEN", "Sin permiso canResolveResultIdentity.", 403);
  }
  const snap = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: { contestId: input.contestId, anonymousCode: input.anonymousCode },
    include: {
      entry: {
        select: {
          id: true,
          authorUserId: true,
          registrationId: true,
          clickatonParticipantNumber: true,
        },
      },
    },
  });
  if (!snap) return null;

  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_IDENTITY_RESOLVED",
    entityType: "FotorankJuryEntrySnapshot",
    entityId: snap.id,
    payload: { anonymousCode: input.anonymousCode },
  });

  return {
    anonymousCode: snap.anonymousCode,
    entryId: snap.entryId,
    authorUserId: snap.entry.authorUserId,
    registrationId: snap.entry.registrationId,
    clickatonParticipantNumber: snap.entry.clickatonParticipantNumber,
    categoryId: snap.categoryId,
    promptExternalId: snap.promptExternalId,
  };
}

export async function exportBlindResultsCsv(contestId: string, batchId: string) {
  const entries = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: batchId, resultBatch: { contestId } },
    orderBy: [{ scopeKey: "asc" }, { preliminaryPosition: "asc" }],
  });
  const header = [
    "codigo_anonimo",
    "categoria",
    "consigna",
    "score",
    "normalizado",
    "posicion",
    "premio",
    "estado",
    "cobertura",
  ].join(",");
  const lines = entries.map((e) =>
    [
      e.anonymousCode,
      e.categoryId,
      e.promptExternalId ?? "",
      e.aggregateScore ?? "",
      e.normalizedScore ?? "",
      e.finalPosition ?? e.preliminaryPosition ?? "",
      e.awardType ?? "",
      e.resultStatus,
      e.coverageStatus,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export async function exportAdminResultsCsv(
  contestId: string,
  batchId: string,
  resolveIdentity: boolean,
) {
  const entries = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: batchId, resultBatch: { contestId } },
    include: {
      juryEntrySnapshot: {
        include: {
          entry: {
            select: {
              authorUserId: true,
              registrationId: true,
              clickatonParticipantNumber: true,
            },
          },
        },
      },
    },
    orderBy: [{ scopeKey: "asc" }, { preliminaryPosition: "asc" }],
  });
  const header = [
    "codigo_anonimo",
    "author_user_id",
    "registration_id",
    "clickaton_number",
    "categoria",
    "consigna",
    "score",
    "posicion",
    "premio",
    "estado",
  ].join(",");
  const lines = entries.map((e) =>
    [
      e.anonymousCode,
      resolveIdentity ? (e.juryEntrySnapshot.entry.authorUserId ?? "") : "",
      resolveIdentity ? (e.juryEntrySnapshot.entry.registrationId ?? "") : "",
      resolveIdentity
        ? (e.juryEntrySnapshot.entry.clickatonParticipantNumber ?? "")
        : "",
      e.categoryId,
      e.promptExternalId ?? "",
      e.aggregateScore ?? "",
      e.finalPosition ?? e.preliminaryPosition ?? "",
      e.awardType ?? "",
      e.resultStatus,
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export { participantResultsMessage } from "./participant-message";
