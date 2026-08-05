/**
 * Selfcheck ETAPA 07 — rúbrica Santa Fe, scoring, tie-break, cobertura.
 */
import assert from "node:assert/strict";
import {
  SANTA_FE_EN_FOCO_JURY_CRITERIA,
  SANTA_FE_MIN_EVALUATIONS_PER_ENTRY,
  SANTA_FE_PRIORITY_CRITERION_KEY,
} from "./santa-fe-en-foco-rubric";
import { computeWeightedScore } from "./scoring-engine";
import { computeRanking } from "../results/ranking-engine";
import { countValidEvaluationsForCoverage } from "./conflict-reassign-service";

function section(title: string) {
  console.log(`\n== ${title}`);
}

function main() {
  section("1. rúbrica 5×20");
  assert.equal(SANTA_FE_EN_FOCO_JURY_CRITERIA.length, 5);
  const weightSum = SANTA_FE_EN_FOCO_JURY_CRITERIA.reduce((a, c) => a + c.weight, 0);
  assert.equal(weightSum, 100);
  for (const c of SANTA_FE_EN_FOCO_JURY_CRITERIA) {
    assert.equal(c.minScore, 1);
    assert.equal(c.maxScore, 10);
    assert.equal(c.required, true);
  }
  assert.equal(SANTA_FE_MIN_EVALUATIONS_PER_ENTRY, 3);
  assert.ok(SANTA_FE_EN_FOCO_JURY_CRITERIA.some((c) => c.key === SANTA_FE_PRIORITY_CRITERION_KEY));

  section("2. scoring ponderado");
  const criteria = SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
    key: c.key,
    name: c.name,
    weight: c.weight,
    minScore: c.minScore,
    maxScore: c.maxScore,
    step: c.step,
    required: c.required,
  }));
  const scores = criteria.map((c) => ({ key: c.key, score: 8 }));
  const computed = computeWeightedScore({ criteria, scores, requireAllRequired: true });
  assert.equal(computed.ok, true);
  if (computed.ok) {
    assert.equal(computed.totalScore, 8);
    assert.ok(computed.normalizedScore > 0 && computed.normalizedScore <= 1);
  }

  section("3. submit incompleto rechazado");
  const incomplete = computeWeightedScore({
    criteria,
    scores: [{ key: "composition", score: 7 }],
    requireAllRequired: true,
  });
  assert.equal(incomplete.ok, false);

  section("4. cobertura mínima 3");
  assert.equal(countValidEvaluationsForCoverage([]), 0);
  assert.equal(countValidEvaluationsForCoverage(["SUBMITTED"]), 1);
  assert.equal(countValidEvaluationsForCoverage(["SUBMITTED", "LOCKED"]), 2);
  assert.equal(
    countValidEvaluationsForCoverage(["SUBMITTED", "LOCKED", "SUBMITTED"]),
    3,
  );
  assert.equal(
    countValidEvaluationsForCoverage(["SUBMITTED", "LOCKED", "SUBMITTED", "LOCKED"]),
    4,
  );
  assert.equal(
    countValidEvaluationsForCoverage(["SUBMITTED", "VOIDED", "LOCKED"]),
    2,
  );
  assert.equal(
    countValidEvaluationsForCoverage(["IN_PROGRESS", "NOT_STARTED", "VOIDED"]),
    0,
  );
  const byEntry = new Map<string, number>([
    ["a", 3],
    ["b", 2],
    ["c", 5],
  ]);
  let incompleteCount = 0;
  for (const n of byEntry.values()) {
    if (n < SANTA_FE_MIN_EVALUATIONS_PER_ENTRY) incompleteCount += 1;
  }
  assert.equal(incompleteCount, 1);

  section("5. tie-break ranking-engine");
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
        anonymousCode: "A-001",
        categoryId: "cat",
        promptExternalId: null,
        admissionStatus: "FROZEN_FOR_JURY",
        entryStatus: "CONFIRMED",
      },
      {
        snapshotId: "s2",
        anonymousCode: "A-002",
        categoryId: "cat",
        promptExternalId: null,
        admissionStatus: "FROZEN_FOR_JURY",
        entryStatus: "CONFIRMED",
      },
    ],
    evaluations: [
      ...Array.from({ length: 3 }, () => ({
        snapshotId: "s1",
        anonymousCode: "A-001",
        categoryId: "cat",
        promptExternalId: null,
        totalScore: 8,
        normalizedScore: 0.8,
        priorityCriterionScore: 9,
        status: "SUBMITTED" as const,
      })),
      ...Array.from({ length: 3 }, () => ({
        snapshotId: "s2",
        anonymousCode: "A-002",
        categoryId: "cat",
        promptExternalId: null,
        totalScore: 8,
        normalizedScore: 0.8,
        priorityCriterionScore: 7,
        status: "SUBMITTED" as const,
      })),
    ],
  });
  assert.ok(works.length >= 2);
  const first = works.find((r) => r.preliminaryPosition === 1);
  assert.equal(first?.snapshotId, "s1");

  section("6. escala 5k IDs (perf smoke)");
  const ids = Array.from({ length: 5000 }, (_, i) => `snap-${i}`);
  const t0 = Date.now();
  const set = new Set(ids);
  assert.equal(set.size, 5000);
  assert.ok(Date.now() - t0 < 500);

  console.log("\nsanta-fe-jury.selfcheck: OK");
}

main();
