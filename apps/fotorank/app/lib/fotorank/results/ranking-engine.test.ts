/**
 * Lo que cambió en la v2 del motor de ranking (2026-09-25).
 */
import assert from "node:assert/strict";
import test from "node:test";

import { aggregateScores, computeRanking, type EvaluationInput, type EntryMeta } from "./ranking-engine";

const REGLAS = {
  aggregationMethod: "AVERAGE" as const,
  tieBreakStrategy: "MEDIAN_THEN_DISPERSION" as const,
  minimumValidEvaluations: 1,
  discardHighestScore: false,
  discardLowestScore: false,
  ruleSetVersion: 1,
  winnersPerScope: 3,
};

function obra(id: string): EntryMeta {
  return {
    snapshotId: id,
    anonymousCode: id.toUpperCase(),
    categoryId: "c",
    promptExternalId: "p",
    admissionStatus: "FROZEN_FOR_JURY",
    entryStatus: "SUBMITTED",
  };
}
function nota(id: string, n: number): EvaluationInput {
  return {
    snapshotId: id,
    anonymousCode: id.toUpperCase(),
    categoryId: "c",
    promptExternalId: "p",
    totalScore: n,
    normalizedScore: n / 10,
    status: "SUBMITTED",
  };
}

test("la media recortada descarta la nota más alta y la más baja", () => {
  const r = aggregateScores([0.1, 0.5, 0.6, 1.0], [1, 5, 6, 10], {
    aggregationMethod: "TRIMMED_MEAN",
    discardHighestScore: false,
    discardLowestScore: false,
  });
  assert.equal(r.aggregate, 5.5);
});

test("un empate fuera de los premios comparte el puesto y no frena el cierre", () => {
  const ids = ["a", "b", "c", "d", "e"];
  const notas = [9, 8, 7, 5, 5];
  const { works } = computeRanking({
    entries: ids.map(obra),
    evaluations: ids.map((id, i) => nota(id, notas[i]!)),
    rules: REGLAS,
    scope: "CATEGORY_AND_PROMPT",
  });
  const d = works.find((w) => w.snapshotId === "d")!;
  const e = works.find((w) => w.snapshotId === "e")!;
  assert.equal(d.preliminaryPosition, 4);
  assert.equal(e.preliminaryPosition, 4);
  assert.equal(d.resultStatus, "RANKED");
  assert.ok(!d.flags.includes("MANUAL_TIEBREAK_REQUIRED"));
});

test("un empate que decide un premio sí pide desempate", () => {
  const ids = ["a", "b", "c"];
  const notas = [9, 8, 8];
  const { works } = computeRanking({
    entries: ids.map(obra),
    evaluations: ids.map((id, i) => nota(id, notas[i]!)),
    rules: REGLAS,
    scope: "CATEGORY_AND_PROMPT",
  });
  const b = works.find((w) => w.snapshotId === "b")!;
  assert.equal(b.resultStatus, "TIED");
  assert.ok(b.flags.includes("MANUAL_TIEBREAK_REQUIRED"));
});

test("con empate compartido, ni siquiera un premio exige desempate", () => {
  const { works } = computeRanking({
    entries: ["a", "b"].map(obra),
    evaluations: [nota("a", 8), nota("b", 8)],
    rules: { ...REGLAS, tieBreakStrategy: "SHARED_TIE" },
    scope: "CATEGORY_AND_PROMPT",
  });
  assert.ok(works.every((w) => w.preliminaryPosition === 1 && w.resultStatus === "RANKED"));
});
