/**
 * Falla si el ranking Santa Fe pudiera alimentarse desde FotorankJudgeVote.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeRanking } from "./ranking-engine";
import { SANTA_FE_PRIORITY_CRITERION_KEY } from "../jury/santa-fe-en-foco-rubric";

const here = dirname(fileURLToPath(import.meta.url));

function main() {
  const resultService = readFileSync(join(here, "result-service.ts"), "utf8");
  assert.equal(
    /fotorankJudgeVote/i.test(resultService),
    false,
    "result-service.ts no debe referenciar fotorankJudgeVote",
  );
  assert.ok(
    /fotorankJuryEvaluation/i.test(resultService),
    "result-service.ts debe usar fotorankJuryEvaluation",
  );

  const rankingEngine = readFileSync(join(here, "ranking-engine.ts"), "utf8");
  assert.equal(/JudgeVote/i.test(rankingEngine), false);

  // Solo SUBMITTED/LOCKED puntúan; VOID/IN_PROGRESS no.
  const { works } = computeRanking({
    scope: "CATEGORY",
    rules: {
      aggregationMethod: "WEIGHTED_AVERAGE",
      tieBreakStrategy: "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION",
      minimumValidEvaluations: 3,
      discardHighestScore: false,
      discardLowestScore: false,
      priorityCriterionKey: SANTA_FE_PRIORITY_CRITERION_KEY,
      ruleSetVersion: 1,
    },
    entries: [
      {
        snapshotId: "s1",
        anonymousCode: "A",
        categoryId: "c",
        promptExternalId: null,
        admissionStatus: "FROZEN_FOR_JURY",
        entryStatus: "CONFIRMED",
      },
    ],
    evaluations: [
      {
        snapshotId: "s1",
        anonymousCode: "A",
        categoryId: "c",
        promptExternalId: null,
        totalScore: 9,
        normalizedScore: 0.9,
        priorityCriterionScore: 9,
        status: "VOIDED",
      },
      {
        snapshotId: "s1",
        anonymousCode: "A",
        categoryId: "c",
        promptExternalId: null,
        totalScore: 8,
        normalizedScore: 0.8,
        priorityCriterionScore: 8,
        status: "IN_PROGRESS",
      },
      ...Array.from({ length: 3 }, () => ({
        snapshotId: "s1",
        anonymousCode: "A",
        categoryId: "c",
        promptExternalId: null,
        totalScore: 7,
        normalizedScore: 0.7,
        priorityCriterionScore: 7,
        status: "SUBMITTED" as const,
      })),
    ],
  });
  assert.equal(works[0]?.evaluationCount, 3);
  assert.equal(works[0]?.coverageStatus, "COMPLETE");

  console.log("santa-fe-ranking-source.selfcheck: OK");
}

main();
