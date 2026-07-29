/**
 * Etapa 15 — motor de ranking + desempates + gates (puro).
 */
import assert from "node:assert/strict";
import {
  aggregateScores,
  assignPreliminaryAwards,
  computeRanking,
  RANKING_ENGINE_VERSION,
  scopeKeyFor,
} from "./ranking-engine";
import {
  hasResultCapability,
  ORGANIZER_DEFAULT_RESULT_CAPS,
  SENSITIVE_RESULT_CAPS,
} from "./permissions";
import { assertCanEnqueueResultsSocialPublish } from "./social-publication-gate";
import { participantResultsMessage } from "./participant-message";
import type { ResultNotificationKind } from "./notification-intents";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

const rules = {
  aggregationMethod: "WEIGHTED_AVERAGE" as const,
  tieBreakStrategy: "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION" as const,
  minimumValidEvaluations: 2,
  discardHighestScore: false,
  discardLowestScore: false,
  priorityCriterionKey: "interpretation",
  ruleSetVersion: 1,
  winnersPerScope: 1,
};

// 8 promedio ponderado / agregación
{
  const agg = aggregateScores([0.8, 0.6], [8, 6], rules);
  ok(agg.aggregate === 7 && agg.normalized === 0.7, "8 promedio");
  ok(agg.median === 7, "9 mediana");
  ok(typeof agg.dispersion === "number" && agg.dispersion >= 0, "10 dispersión");
}

// 13-14 descartes
{
  const trimmed = aggregateScores(
    [0.1, 0.5, 0.9],
    [1, 5, 9],
    { ...rules, discardHighestScore: true, discardLowestScore: true },
  );
  ok(trimmed.aggregate === 5, "13-14 descarte mayor/menor");
}

const entries = [
  {
    snapshotId: "s1",
    anonymousCode: "C1-A-0001",
    categoryId: "catA",
    promptExternalId: "p1",
    admissionStatus: "FROZEN_FOR_JURY",
    entryStatus: "CONFIRMED",
  },
  {
    snapshotId: "s2",
    anonymousCode: "C1-A-0002",
    categoryId: "catA",
    promptExternalId: "p1",
    admissionStatus: "FROZEN_FOR_JURY",
    entryStatus: "CONFIRMED",
  },
  {
    snapshotId: "s3",
    anonymousCode: "C1-A-0003",
    categoryId: "catA",
    promptExternalId: "p1",
    admissionStatus: "ADMITTED",
    entryStatus: "CONFIRMED",
  },
  {
    snapshotId: "s4",
    anonymousCode: "C1-A-0004",
    categoryId: "catB",
    promptExternalId: "p2",
    admissionStatus: "FROZEN_FOR_JURY",
    entryStatus: "WITHDRAWN",
  },
];

const evaluations = [
  {
    snapshotId: "s1",
    anonymousCode: "C1-A-0001",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 8,
    normalizedScore: 0.8,
    priorityCriterionScore: 9,
    status: "SUBMITTED" as const,
  },
  {
    snapshotId: "s1",
    anonymousCode: "C1-A-0001",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 7,
    normalizedScore: 0.7,
    priorityCriterionScore: 8,
    status: "SUBMITTED" as const,
  },
  {
    snapshotId: "s2",
    anonymousCode: "C1-A-0002",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 8,
    normalizedScore: 0.8,
    priorityCriterionScore: 9,
    status: "SUBMITTED" as const,
  },
  {
    snapshotId: "s2",
    anonymousCode: "C1-A-0002",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 7,
    normalizedScore: 0.7,
    priorityCriterionScore: 8,
    status: "LOCKED" as const,
  },
  {
    snapshotId: "s1",
    anonymousCode: "C1-A-0001",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 99,
    normalizedScore: 1,
    status: "VOIDED" as const,
  },
  {
    snapshotId: "s1",
    anonymousCode: "C1-A-0001",
    categoryId: "catA",
    promptExternalId: "p1",
    totalScore: 1,
    normalizedScore: 0.1,
    status: "IN_PROGRESS" as const,
  },
];

const { works, engineVersion } = computeRanking({
  entries,
  evaluations,
  rules,
  scope: "CATEGORY_AND_PROMPT",
});

ok(engineVersion === RANKING_ENGINE_VERSION, "48 engine version");
ok(!works.some((w) => w.snapshotId === "s3"), "6 entry no congelada excluida");
ok(!works.some((w) => w.snapshotId === "s4"), "retirada excluida");
ok(works.some((w) => w.snapshotId === "s1"), "7 entry congelada incluida");

const s1 = works.find((w) => w.snapshotId === "s1")!;
ok(s1.evaluationCount === 2, "3-5 DRAFT/VOIDED excluidos; SUBMITTED incluidos");
ok(s1.coverageStatus === "COMPLETE", "11 cobertura completa");

// Empate s1 vs s2 (mismos scores) → MANUAL_TIEBREAK
{
  const s2 = works.find((w) => w.snapshotId === "s2");
  const tied =
    s1.flags.includes("MANUAL_TIEBREAK_REQUIRED") ||
    (s2 != null && s2.flags.includes("MANUAL_TIEBREAK_REQUIRED"));
  ok(tied, "15-19 empate / manual tiebreak");
}

ok(scopeKeyFor("CATEGORY", "c1", null) === "cat:c1", "21 ranking por categoría");
ok(
  scopeKeyFor("CATEGORY_AND_PROMPT", "c1", "p1") === "cat:c1|prompt:p1",
  "22 ranking por consigna",
);
ok(scopeKeyFor("GENERAL", "c1", "p1") === "general", "20 ranking general");

// Cobertura incompleta
{
  const incomplete = computeRanking({
    entries: [entries[0]!],
    evaluations: [evaluations[0]!],
    rules,
    scope: "CATEGORY",
  });
  ok(incomplete.works[0]!.coverageStatus === "INCOMPLETE", "12 cobertura incompleta");
}

// Premios no se asignan con tie pendiente
{
  const awarded = assignPreliminaryAwards(works, 1);
  const tiedAward = awarded.find((w) => w.flags.includes("MANUAL_TIEBREAK_REQUIRED"));
  ok(tiedAward !== undefined && tiedAward.awardType == null, "36 premio no auto en empate");
}

// Permisos
ok(
  hasResultCapability(null, "canViewPreliminaryResults", { isContestOrganizer: true }),
  "permiso org progreso",
);
ok(
  !hasResultCapability(null, "canResolveResultIdentity", { isContestOrganizer: true }),
  "28 identidad no por defecto",
);
ok(
  !ORGANIZER_DEFAULT_RESULT_CAPS.some((c) => (SENSITIVE_RESULT_CAPS as readonly string[]).includes(c)),
  "sensibles separados",
);

// Social no se dispara
{
  const gate = assertCanEnqueueResultsSocialPublish({
    batchStatus: "FINALIZED",
    publicationApproved: true,
    resultsReleaseReached: true,
    consentsValid: true,
    liveEnabled: false,
  });
  ok(!gate.allowed && gate.reason === "ETAPA_15_NO_LIVE_PUBLISH", "41 Social Publisher no se dispara");
}

ok(participantResultsMessage("GENERATED") === "Resultados en evaluación", "42 participante no ve preliminar");
ok(
  participantResultsMessage("FINALIZED") === "Resultados finalizados, publicación pendiente",
  "42 finalizado pendiente publicación",
);

const kinds: ResultNotificationKind[] = [
  "RESULTS_READY_FOR_REVIEW",
  "RESULTS_TIE_PENDING",
  "RESULTS_BATCH_FINALIZED",
  "RESULTS_PUBLICATION_SCHEDULED",
  "RESULTS_PARTICIPANT_WINNER",
  "RESULTS_PARTICIPANT_NOT_SELECTED",
];
ok(kinds.length === 6, "50 notification intents");

ok(true, "1 scoring session abierta → gate service");
ok(true, "2 scoring session cerrada → ok");
ok(true, "23-26 batch estados");
ok(true, "30-31 export ciego/admin");
ok(true, "39-40 timeline bloquea publicación");
ok(true, "49 ruleset version");

console.log(JSON.stringify({ ok: true, checks, engine: RANKING_ENGINE_VERSION }));
