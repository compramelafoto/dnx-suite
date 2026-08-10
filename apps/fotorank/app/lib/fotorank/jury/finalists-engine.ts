/**
 * ETAPA 16B — Motor de finalistas (§5.1, §8 master rules).
 * "FINALISTA ≠ ganador definitivo." Selecciona exactamente `finalistsPerUnit` finalistas por
 * `promptExternalId` a partir del ranking de jurado. `internalJuryRank` es SOLO el orden interno
 * usado para el corte de selección; NUNCA la posición pública definitiva (eso lo decide el público).
 *
 * Orden de desempate (§5.1): promedio general → criterios en el orden de la rúbrica activa
 * (sortOrder asc). Para Clickatón esto es exactamente Interpretación → Creatividad → Composición
 * sin hardcodear esas claves en el motor (se lee de `FotorankJuryCriterion.sortOrder`).
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJuryActivationAllowed } from "./commercial-contest-guard";
import { assertNoPiiInFinalistMetadata } from "./finalist-pii-guard";
import { computePrivateAggregates } from "./scoring-engine";
import { getOrCreateCompetitionJuryConfig } from "./competition-jury-config";
import { requestExtraJudgeTiebreak } from "./tiebreak-extra-judge";
import { enqueueJuryNotificationIntent } from "./notification-intents";

function newId(prefix: string) {
  return `${prefix}${randomBytes(12).toString("hex")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const EPSILON = 1e-9;

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON;
}

type Candidate = {
  snapshotId: string;
  entryId: string | null;
  categoryId: string;
  anonymousCode: string;
  averageScore: number | null;
  normalizedAverage: number | null;
  evaluationCount: number;
  criterionAvgs: Map<string, number>;
};

function sortKeyOf(candidate: Candidate, tieBreakKeys: string[]): number[] {
  return [
    candidate.normalizedAverage ?? -Infinity,
    ...tieBreakKeys.map((k) => candidate.criterionAvgs.get(k) ?? -Infinity),
  ];
}

function keysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => nearlyEqual(v, b[i]!));
}

function compareCandidates(a: Candidate, b: Candidate, tieBreakKeys: string[]): number {
  const ka = sortKeyOf(a, tieBreakKeys);
  const kb = sortKeyOf(b, tieBreakKeys);
  for (let i = 0; i < ka.length; i++) {
    if (!nearlyEqual(ka[i]!, kb[i]!)) return kb[i]! - ka[i]!;
  }
  // Determinismo final (sin afectar semántica de negocio): orden estable por snapshotId.
  return a.snapshotId.localeCompare(b.snapshotId);
}

export type FinalistPromptResult = {
  promptExternalId: string;
  promptSequence: number;
  eligibleCandidateCount: number;
  tieBreakRequired: boolean;
  finalists: Array<{
    finalistSnapshotId: string;
    juryEntrySnapshotId: string;
    entryId: string | null;
    publicCode: string;
    internalJuryRank: number;
    aggregateScore: number | null;
    normalizedScore: number | null;
  }>;
};

export type FinalistsSelectionResult = {
  resultBatchId: string;
  ruleSetId: string;
  scoringSessionId: string;
  finalistsPerPrompt: number;
  promptResults: FinalistPromptResult[];
  tieBreakRequiredPromptIds: string[];
};

async function resolvePromptSequences(promptExternalIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (promptExternalIds.length === 0) return map;
  const prompts = await prisma.clickatonPrompt.findMany({
    where: { id: { in: promptExternalIds } },
    select: { id: true, sequence: true },
  });
  for (const p of prompts) map.set(p.id, p.sequence);
  const missing = promptExternalIds.filter((id) => !map.has(id)).sort((a, b) => a.localeCompare(b));
  missing.forEach((id, idx) => map.set(id, map.size + idx + 1));
  return map;
}

async function ensureFinalistsRuleSet(input: {
  contestId: string;
  scoringSessionId: string;
  finalistsPerPrompt: number;
  actorUserId: number;
}) {
  const RULE_SET_NAME = "Finalistas (§8 master rules)";
  const existing = await prisma.fotorankResultRuleSet.findFirst({
    where: { contestId: input.contestId, scoringSessionId: input.scoringSessionId, name: RULE_SET_NAME },
  });
  if (existing) return existing;

  const maxVersion = await prisma.fotorankResultRuleSet.aggregate({
    where: { contestId: input.contestId, name: RULE_SET_NAME },
    _max: { version: true },
  });

  return prisma.fotorankResultRuleSet.create({
    data: {
      id: newId("frs"),
      contestId: input.contestId,
      scoringSessionId: input.scoringSessionId,
      version: (maxVersion._max.version ?? 0) + 1,
      name: RULE_SET_NAME,
      status: "ACTIVE",
      aggregationMethod: "WEIGHTED_AVERAGE",
      tieBreakStrategy: "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION",
      minimumValidEvaluations: 1,
      normalizationMode: "NORMALIZED_TOTAL",
      // Jurado NUNCA decide el ganador definitivo (§1, §8): no habilita ranking público.
      rankingEnabled: false,
      winnersPerScope: input.finalistsPerPrompt,
      allowMultipleAwards: true,
      oneAwardPerParticipant: false,
      incompleteCoveragePolicy: "BLOCK_FINALIZE",
      createdByUserId: input.actorUserId,
      activatedByUserId: input.actorUserId,
      activatedAt: new Date(),
      configJson: { engine: "finalists-engine-16b", finalistsPerPrompt: input.finalistsPerPrompt },
    },
  });
}

async function ensureFinalistsResultBatch(input: {
  contestId: string;
  admissionBatchId: string;
  scoringSessionId: string;
  ruleSetId: string;
  actorUserId: number;
}) {
  const idempotencyKey = `finalists:${input.scoringSessionId}`;
  const existing = await prisma.fotorankResultBatch.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  return prisma.fotorankResultBatch.create({
    data: {
      id: newId("frb"),
      contestId: input.contestId,
      admissionBatchId: input.admissionBatchId,
      scoringSessionId: input.scoringSessionId,
      ruleSetId: input.ruleSetId,
      status: "DRAFT",
      scope: "PROMPT",
      generatedAt: new Date(),
      generatedByUserId: input.actorUserId,
      engineVersion: "finalists-engine-16b",
      idempotencyKey,
      metadata: { purpose: "FINALISTS_ONLY", publicRankingDecidedByJury: false },
    },
  });
}

/**
 * Calcula y persiste los finalistas por consigna para una sesión de jurado CLOSED/LOCKED.
 * Idempotente por consigna: si ya hay un `FotorankFinalistPackage` CONFIRMED para la sesión,
 * bloquea (usar `revokeFinalist` + re-confirmación para cambios post-confirmación).
 */
export async function selectFinalistsPerPrompt(input: {
  contestId: string;
  scoringSessionId: string;
  actorUserId: number;
  finalistsPerPrompt?: number;
}): Promise<FinalistsSelectionResult> {
  assertJuryActivationAllowed(input.contestId);

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { id: input.scoringSessionId, contestId: input.contestId },
    include: { rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "Sesión de jurado no encontrada.", 404);
  if (session.status !== "CLOSED" && session.status !== "LOCKED") {
    throw new JuryError(
      "SESSION_NOT_CLOSED",
      "La sesión de jurado debe estar CLOSED antes de calcular finalistas.",
      409,
    );
  }

  const confirmedPackage = await prisma.fotorankFinalistPackage.findFirst({
    where: { contestId: input.contestId, scoringSessionId: input.scoringSessionId, status: "CONFIRMED" },
  });
  if (confirmedPackage) {
    throw new JuryError(
      "PACKAGE_IMMUTABLE",
      "Ya hay un paquete de finalistas CONFIRMED para esta sesión. Usá revokeFinalist para modificarlo.",
      409,
    );
  }

  const config = await getOrCreateCompetitionJuryConfig(input.contestId);
  const finalistsPerPrompt = input.finalistsPerPrompt ?? config.finalistsPerUnit ?? 3;
  const tieBreakKeys = session.rubric.criteria.map((c) => c.key);

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: session.admissionBatchId, promptExternalId: { not: null } },
    select: { id: true, entryId: true, categoryId: true, anonymousCode: true, promptExternalId: true },
  });
  const snapshotIds = snapshots.map((s) => s.id);

  const evaluations = snapshotIds.length
    ? await prisma.fotorankJuryEvaluation.findMany({
        where: {
          scoringSessionId: session.id,
          juryEntrySnapshotId: { in: snapshotIds },
          status: { in: ["SUBMITTED", "LOCKED"] },
        },
        select: {
          juryEntrySnapshotId: true,
          totalScore: true,
          normalizedScore: true,
          criterionScores: { select: { criterionKeySnapshot: true, score: true } },
        },
      })
    : [];

  const evalsBySnapshot = new Map<string, typeof evaluations>();
  for (const e of evaluations) {
    const arr = evalsBySnapshot.get(e.juryEntrySnapshotId) ?? [];
    arr.push(e);
    evalsBySnapshot.set(e.juryEntrySnapshotId, arr);
  }

  const requiredEvaluationsPerEntry = session.minimumEvaluationsPerEntry;
  const candidatesById = new Map<string, Candidate>();
  for (const snap of snapshots) {
    const evals = evalsBySnapshot.get(snap.id) ?? [];
    if (evals.length < requiredEvaluationsPerEntry) continue; // §5: "Entrada a ranking: solo con N evaluaciones completas".

    const totals = evals.map((e) => e.totalScore).filter((v): v is number => typeof v === "number");
    const norms = evals.map((e) => e.normalizedScore).filter((v): v is number => typeof v === "number");
    const agg = computePrivateAggregates(totals);
    const normAgg = computePrivateAggregates(norms);

    const criterionAvgs = new Map<string, number>();
    for (const key of tieBreakKeys) {
      const scores = evals
        .flatMap((e) => e.criterionScores.filter((c) => c.criterionKeySnapshot === key).map((c) => c.score))
        .filter((v): v is number => typeof v === "number");
      if (scores.length > 0) {
        criterionAvgs.set(key, scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    }

    candidatesById.set(snap.id, {
      snapshotId: snap.id,
      entryId: snap.entryId,
      categoryId: snap.categoryId,
      anonymousCode: snap.anonymousCode,
      averageScore: agg.average,
      normalizedAverage: normAgg.average,
      evaluationCount: evals.length,
      criterionAvgs,
    });
  }

  const byPrompt = new Map<string, Candidate[]>();
  for (const snap of snapshots) {
    const candidate = candidatesById.get(snap.id);
    if (!candidate || !snap.promptExternalId) continue;
    const arr = byPrompt.get(snap.promptExternalId) ?? [];
    arr.push(candidate);
    byPrompt.set(snap.promptExternalId, arr);
  }

  const promptSequences = await resolvePromptSequences([...byPrompt.keys()]);
  const ruleSet = await ensureFinalistsRuleSet({
    contestId: input.contestId,
    scoringSessionId: session.id,
    finalistsPerPrompt,
    actorUserId: input.actorUserId,
  });
  const resultBatch = await ensureFinalistsResultBatch({
    contestId: input.contestId,
    admissionBatchId: session.admissionBatchId,
    scoringSessionId: session.id,
    ruleSetId: ruleSet.id,
    actorUserId: input.actorUserId,
  });

  const promptResults: FinalistPromptResult[] = [];
  const tieBreakRequiredPromptIds: string[] = [];

  for (const [promptExternalId, candidates] of byPrompt.entries()) {
    const sorted = [...candidates].sort((a, b) => compareCandidates(a, b, tieBreakKeys));
    const cutIndex = Math.min(finalistsPerPrompt, sorted.length) - 1;

    let tieBreakRequired = false;
    let tiedSnapshotIds: string[] = [];
    if (cutIndex >= 0 && cutIndex + 1 < sorted.length) {
      const boundaryKey = sortKeyOf(sorted[cutIndex]!, tieBreakKeys);
      const nextKey = sortKeyOf(sorted[cutIndex + 1]!, tieBreakKeys);
      if (keysEqual(boundaryKey, nextKey)) {
        tieBreakRequired = true;
        tiedSnapshotIds = sorted
          .filter((c) => keysEqual(sortKeyOf(c, tieBreakKeys), boundaryKey))
          .map((c) => c.snapshotId);
      }
    }

    const promptSequence = promptSequences.get(promptExternalId) ?? 0;

    // Limpiar finalistas DRAFT previos de esta consigna/sesión antes de recalcular (idempotente
    // hasta que el paquete se confirme; ver guard de PACKAGE_IMMUTABLE más arriba).
    await prisma.fotorankFinalistSnapshot.deleteMany({
      where: { contestId: input.contestId, scoringSessionId: session.id, promptExternalId, status: "DRAFT" },
    });

    if (tieBreakRequired) {
      tieBreakRequiredPromptIds.push(promptExternalId);
      await requestExtraJudgeTiebreak({
        contestId: input.contestId,
        snapshotIds: tiedSnapshotIds,
        actorUserId: input.actorUserId,
      });
      promptResults.push({
        promptExternalId,
        promptSequence,
        eligibleCandidateCount: sorted.length,
        tieBreakRequired: true,
        finalists: [],
      });
      continue;
    }

    const top = sorted.slice(0, Math.min(finalistsPerPrompt, sorted.length));
    const createdFinalists: FinalistPromptResult["finalists"] = [];

    for (let i = 0; i < top.length; i++) {
      const candidate = top[i]!;
      const internalJuryRank = i + 1;
      const publicCode = `C${pad2(promptSequence)}-F${pad2(internalJuryRank)}`;
      const metadataJson = {
        evaluationCount: candidate.evaluationCount,
        engineVersion: "finalists-engine-16b",
      };
      assertNoPiiInFinalistMetadata(metadataJson);

      const created = await prisma.fotorankFinalistSnapshot.create({
        data: {
          id: newId("ffs"),
          contestId: input.contestId,
          scoringSessionId: session.id,
          resultBatchId: resultBatch.id,
          promptExternalId,
          promptSequence,
          entryId: candidate.entryId,
          juryEntrySnapshotId: candidate.snapshotId,
          publicCode,
          internalJuryRank,
          aggregateScore: candidate.averageScore,
          normalizedScore: candidate.normalizedAverage,
          status: "DRAFT",
          metadataJson,
        },
      });

      await prisma.fotorankResultEntry.upsert({
        where: {
          resultBatchId_juryEntrySnapshotId_scopeKey: {
            resultBatchId: resultBatch.id,
            juryEntrySnapshotId: candidate.snapshotId,
            scopeKey: `PROMPT:${promptExternalId}`,
          },
        },
        create: {
          id: newId("fre"),
          resultBatchId: resultBatch.id,
          juryEntrySnapshotId: candidate.snapshotId,
          anonymousCode: candidate.anonymousCode,
          categoryId: candidate.categoryId,
          promptExternalId,
          scopeKey: `PROMPT:${promptExternalId}`,
          aggregateScore: candidate.averageScore,
          normalizedScore: candidate.normalizedAverage,
          evaluationCount: candidate.evaluationCount,
          coverageStatus: "COMPLETE",
          preliminaryPosition: internalJuryRank,
          finalPosition: null,
          resultStatus: "FINALIST",
          awardType: "FINALIST",
        },
        update: {
          aggregateScore: candidate.averageScore,
          normalizedScore: candidate.normalizedAverage,
          evaluationCount: candidate.evaluationCount,
          coverageStatus: "COMPLETE",
          preliminaryPosition: internalJuryRank,
          finalPosition: null,
          resultStatus: "FINALIST",
          awardType: "FINALIST",
        },
      });

      createdFinalists.push({
        finalistSnapshotId: created.id,
        juryEntrySnapshotId: candidate.snapshotId,
        entryId: candidate.entryId,
        publicCode,
        internalJuryRank,
        aggregateScore: candidate.averageScore,
        normalizedScore: candidate.normalizedAverage,
      });
    }

    promptResults.push({
      promptExternalId,
      promptSequence,
      eligibleCandidateCount: sorted.length,
      tieBreakRequired: false,
      finalists: createdFinalists,
    });
  }

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: "FINALISTS_SELECTED",
      entityType: "FotorankResultBatch",
      entityId: resultBatch.id,
      payloadJson: {
        scoringSessionId: session.id,
        finalistsPerPrompt,
        promptCount: promptResults.length,
        tieBreakRequiredPromptIds,
      },
    },
  });

  if (tieBreakRequiredPromptIds.length === 0) {
    await enqueueJuryNotificationIntent({
      contestId: input.contestId,
      kind: "FINALISTS_READY",
      scoringSessionId: session.id,
      metadata: {
        resultBatchId: resultBatch.id,
        finalistsPerPrompt,
        promptCount: promptResults.length,
        live: false,
      },
    });
  }

  return {
    resultBatchId: resultBatch.id,
    ruleSetId: ruleSet.id,
    scoringSessionId: session.id,
    finalistsPerPrompt,
    promptResults,
    tieBreakRequiredPromptIds,
  };
}
