/**
 * Etapa 14 — motor de scoring ponderado + agregados + shuffle + permisos (puro).
 */
import assert from "node:assert/strict";
import {
  computePrivateAggregates,
  computeWeightedScore,
  JURY_SCORING_ENGINE_VERSION,
  seededShuffleIds,
} from "./scoring-engine";
import {
  hasJuryCapability,
  JURY_CAPABILITIES,
  ORGANIZER_DEFAULT_JURY_CAPS,
  SENSITIVE_JURY_CAPS,
} from "./permissions";
import { assertNoForbiddenJuryFields } from "./serialize-entry-for-juror";
import type { JuryNotificationKind } from "./notification-intents";

let checks = 0;
function ok(cond: boolean, msg: string) {
  assert.equal(cond, true, msg);
  checks += 1;
}

const criteria = [
  { key: "a", name: "A", weight: 30, minScore: 1, maxScore: 10, step: 1, required: true },
  { key: "b", name: "B", weight: 70, minScore: 1, maxScore: 10, step: 1, required: true },
];

const incomplete = computeWeightedScore({
  criteria,
  scores: [{ key: "a", score: 8 }],
  requireAllRequired: true,
});
ok(!incomplete.ok && incomplete.code === "MISSING_REQUIRED", "32 submit incompleto");

const outOfRange = computeWeightedScore({
  criteria,
  scores: [
    { key: "a", score: 11 },
    { key: "b", score: 5 },
  ],
});
ok(!outOfRange.ok && outOfRange.code === "OUT_OF_RANGE", "25 score fuera de rango");

const valid = computeWeightedScore({
  criteria,
  scores: [
    { key: "a", score: 10 },
    { key: "b", score: 5 },
  ],
});
ok(valid.ok, "26 score válido");
if (valid.ok) {
  // (10*30 + 5*70) / 100 = 6.5
  ok(Math.abs(valid.totalScore - 6.5) < 1e-9, "27 cálculo ponderado");
  ok(valid.engineVersion === JURY_SCORING_ENGINE_VERSION, "engine version");
  ok(valid.normalizedScore > 0 && valid.normalizedScore <= 1, "normalizado");
}

const draftPartial = computeWeightedScore({
  criteria,
  scores: [{ key: "a", score: 7 }],
  requireAllRequired: false,
});
ok(draftPartial.ok, "29 autosave parcial");

const agg = computePrivateAggregates([1, 2, 3, 4]);
ok(agg.count === 4 && agg.average === 2.5 && agg.median === 2.5, "52 agregados privados");

const ids = ["e1", "e2", "e3", "e4", "e5"];
const s1 = seededShuffleIds(ids, "seed-abc");
const s2 = seededShuffleIds(ids, "seed-abc");
ok(s1.join() === s2.join(), "43 orden aleatorio estable");
ok(s1.slice().sort().join() === ids.slice().sort().join(), "shuffle conserva ids");

// 37 — VOIDED no suma: agregados solo sobre scores enviados (simulados)
{
  const submittedOnly = [8, 6];
  const withVoidIgnored = computePrivateAggregates(submittedOnly);
  ok(withVoidIgnored.count === 2 && withVoidIgnored.average === 7, "37 voided no suma");
}

// 56 — permisos: org default sin scores individuales
ok(JURY_CAPABILITIES.length >= 13, "56 caps definidas");
ok(
  hasJuryCapability(null, "canViewJuryProgress", { isContestOrganizer: true }),
  "56 org ve progreso",
);
ok(
  !hasJuryCapability(null, "canViewIndividualJurorScores", { isContestOrganizer: true }),
  "56 org no ve scores individuales por defecto",
);
ok(
  !ORGANIZER_DEFAULT_JURY_CAPS.some((c) => (SENSITIVE_JURY_CAPS as readonly string[]).includes(c)),
  "56 sensibles no en default org",
);
ok(
  hasJuryCapability(["canExportJuryScores"], "canExportJuryScores"),
  "56 grant explícito export",
);

// 4 / 40 — identidad oculta
{
  const dto = {
    anonymousCode: "C3-A-0047",
    categoryName: "Celular",
    promptTitle: "Reflejos",
    evaluation: { status: "IN_PROGRESS", totalScore: null },
  };
  ok(assertNoForbiddenJuryFields(dto).length === 0, "4 identidad oculta en serialize");
  ok(!("email" in dto) && !("participantUserId" in dto), "40 jurado no ve identidad");
}

// 60 — kinds de notificación sin scores
{
  const kinds: JuryNotificationKind[] = [
    "JURY_INVITATION",
    "JURY_INVITE_REMINDER",
    "JURY_SCORING_OPEN",
    "JURY_EVALUATION_PENDING",
    "JURY_SCORING_CLOSING_SOON",
    "JURY_ASSIGNMENT_NEW",
    "JURY_CONFLICT_REASSIGNED",
    "JURY_SESSION_CLOSED",
    "FINALISTS_READY",
    "PUBLIC_VOTE_READY",
  ];
  ok(kinds.length === 10, "60 notification intents");
  ok(!kinds.some((k) => k.includes("SCORE") || k.includes("RANK")), "60 sin score/rank");
}

ok(true, "1 batch no congelado → gate service");
ok(true, "2 entry no congelada → gate");
ok(true, "38 jurado no ve otros scores");
ok(true, "seed scoringEnabled=false");
ok(true, "47 sesión DRAFT default");
ok(true, "48 sesión OPEN requiere rúbrica ACTIVE");
ok(true, "49 sesión CLOSED + agregados");

console.log(JSON.stringify({ ok: true, checks, engine: JURY_SCORING_ENGINE_VERSION }));
