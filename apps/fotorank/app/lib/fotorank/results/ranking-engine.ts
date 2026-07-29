/**
 * Motor puro de ranking Etapa 15 — determinístico, versionado, sin identidad.
 * No publica resultados ni decide ganadores LIVE.
 */

export const RANKING_ENGINE_VERSION = "clickaton-ranking-v1";

export type AggregationMethod =
  | "WEIGHTED_AVERAGE"
  | "AVERAGE"
  | "MEDIAN"
  | "SUM"
  | "TRIMMED_MEAN"
  | "ORDINAL";

export type TieBreakStrategy =
  | "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION"
  | "MEDIAN_THEN_DISPERSION"
  | "MANUAL_ONLY"
  | "SHARED_TIE";

export type CoverageStatus = "COMPLETE" | "INCOMPLETE" | "INVALID" | "REVIEW_REQUIRED";

export type RankingScope = "GENERAL" | "CATEGORY" | "PROMPT" | "CATEGORY_AND_PROMPT" | "SPECIAL";

export type ResultRuleInput = {
  aggregationMethod: AggregationMethod;
  tieBreakStrategy: TieBreakStrategy;
  minimumValidEvaluations: number;
  discardHighestScore: boolean;
  discardLowestScore: boolean;
  priorityCriterionKey?: string | null;
  ruleSetVersion: number;
  winnersPerScope?: number;
};

export type EvaluationInput = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  /** Score total del jurado (backend). */
  totalScore: number;
  /** Score normalizado 0–1. */
  normalizedScore: number;
  /** Score del criterio prioritario (opcional). */
  priorityCriterionScore?: number | null;
  status: "SUBMITTED" | "LOCKED" | "IN_PROGRESS" | "VOIDED" | "NOT_STARTED";
};

export type EntryMeta = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  admissionStatus: string;
  entryStatus: string;
};

export type RankedWork = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  scopeKey: string;
  evaluationCount: number;
  aggregateScore: number | null;
  normalizedScore: number | null;
  medianScore: number | null;
  dispersion: number | null;
  coverageStatus: CoverageStatus;
  preliminaryPosition: number | null;
  tieGroup: string | null;
  resultStatus: "RANKED" | "TIED" | "REVIEW_REQUIRED" | "NOT_SELECTED";
  flags: string[];
  engineVersion: string;
  ruleSetVersion: number;
};

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const v = values.reduce((a, x) => a + (x - avg) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function applyDiscards(scores: number[], discardHigh: boolean, discardLow: boolean): number[] {
  if (scores.length === 0) return scores;
  const sorted = [...scores].sort((a, b) => a - b);
  let start = 0;
  let end = sorted.length;
  // Con ≥3 scores, descartar extremos (ambos si están: quedan los del medio).
  if (discardLow && sorted.length >= 3) start += 1;
  if (discardHigh && sorted.length >= 3) end -= 1;
  return sorted.slice(start, end);
}

export function aggregateScores(
  normalizedScores: number[],
  totalScores: number[],
  rules: Pick<
    ResultRuleInput,
    "aggregationMethod" | "discardHighestScore" | "discardLowestScore"
  >,
): { aggregate: number | null; normalized: number | null; median: number | null; dispersion: number | null } {
  const norms = applyDiscards(
    normalizedScores,
    rules.discardHighestScore,
    rules.discardLowestScore,
  );
  const totals = applyDiscards(totalScores, rules.discardHighestScore, rules.discardLowestScore);
  if (norms.length === 0) {
    return { aggregate: null, normalized: null, median: null, dispersion: null };
  }
  const sortedTotals = [...totals].sort((a, b) => a - b);
  const sortedNorms = [...norms].sort((a, b) => a - b);
  const med = median(sortedTotals);
  const avgNorm = norms.reduce((a, b) => a + b, 0) / norms.length;
  const avgTotal = totals.reduce((a, b) => a + b, 0) / totals.length;
  const disp = stdDev(totals, avgTotal);

  switch (rules.aggregationMethod) {
    case "MEDIAN":
      return {
        aggregate: med,
        normalized: median(sortedNorms),
        median: med,
        dispersion: disp,
      };
    case "SUM":
      return {
        aggregate: totals.reduce((a, b) => a + b, 0),
        normalized: norms.reduce((a, b) => a + b, 0),
        median: med,
        dispersion: disp,
      };
    case "AVERAGE":
    case "WEIGHTED_AVERAGE":
    case "TRIMMED_MEAN":
    default:
      return {
        aggregate: avgTotal,
        normalized: avgNorm,
        median: med,
        dispersion: disp,
      };
  }
}

export function scopeKeyFor(
  scope: RankingScope,
  categoryId: string,
  promptExternalId: string | null,
): string {
  switch (scope) {
    case "GENERAL":
      return "general";
    case "CATEGORY":
      return `cat:${categoryId}`;
    case "PROMPT":
      return `prompt:${promptExternalId ?? "none"}`;
    case "CATEGORY_AND_PROMPT":
      return `cat:${categoryId}|prompt:${promptExternalId ?? "none"}`;
    case "SPECIAL":
      return "special";
    default:
      return `cat:${categoryId}|prompt:${promptExternalId ?? "none"}`;
  }
}

function compareForTieBreak(
  a: RankedWork & { priorityAvg: number | null },
  b: RankedWork & { priorityAvg: number | null },
  strategy: TieBreakStrategy,
): number {
  if (strategy === "MANUAL_ONLY" || strategy === "SHARED_TIE") return 0;

  const scoreCmp = (b.normalizedScore ?? -Infinity) - (a.normalizedScore ?? -Infinity);
  if (Math.abs(scoreCmp) > 1e-9) return scoreCmp;

  if (strategy === "PRIORITY_CRITERION_THEN_MEDIAN_THEN_DISPERSION") {
    const p = (b.priorityAvg ?? -Infinity) - (a.priorityAvg ?? -Infinity);
    if (Math.abs(p) > 1e-9) return p;
  }

  const med = (b.medianScore ?? -Infinity) - (a.medianScore ?? -Infinity);
  if (Math.abs(med) > 1e-9) return med;

  const disp = (a.dispersion ?? Infinity) - (b.dispersion ?? Infinity);
  if (Math.abs(disp) > 1e-9) return disp;

  return 0;
}

/**
 * Calcula ranking por ámbito. Sin identidad. Determinístico.
 */
export function computeRanking(input: {
  entries: EntryMeta[];
  evaluations: EvaluationInput[];
  rules: ResultRuleInput;
  scope: RankingScope;
}): { works: RankedWork[]; engineVersion: string } {
  const validEvals = input.evaluations.filter(
    (e) => e.status === "SUBMITTED" || e.status === "LOCKED",
  );

  const eligibleEntries = input.entries.filter(
    (e) =>
      e.admissionStatus === "FROZEN_FOR_JURY" &&
      e.entryStatus !== "WITHDRAWN" &&
      e.entryStatus !== "REPLACED" &&
      e.entryStatus !== "REJECTED",
  );

  const bySnap = new Map<string, EvaluationInput[]>();
  for (const ev of validEvals) {
    const list = bySnap.get(ev.snapshotId) ?? [];
    list.push(ev);
    bySnap.set(ev.snapshotId, list);
  }

  type WorkAcc = RankedWork & { priorityAvg: number | null };
  const works: WorkAcc[] = [];

  for (const entry of eligibleEntries) {
    const evals = bySnap.get(entry.snapshotId) ?? [];
    const totals = evals.map((e) => e.totalScore);
    const norms = evals.map((e) => e.normalizedScore);
    const agg = aggregateScores(norms, totals, input.rules);
    const priorityScores = evals
      .map((e) => e.priorityCriterionScore)
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const priorityAvg =
      priorityScores.length > 0
        ? priorityScores.reduce((a, b) => a + b, 0) / priorityScores.length
        : null;

    let coverageStatus: CoverageStatus = "COMPLETE";
    const flags: string[] = [];
    if (evals.length < input.rules.minimumValidEvaluations) {
      coverageStatus = "INCOMPLETE";
      flags.push("INSUFFICIENT_EVALUATIONS");
    }
    if (evals.length === 0) {
      coverageStatus = "INVALID";
      flags.push("NO_VALID_EVALUATIONS");
    }

    works.push({
      snapshotId: entry.snapshotId,
      anonymousCode: entry.anonymousCode,
      categoryId: entry.categoryId,
      promptExternalId: entry.promptExternalId,
      scopeKey: scopeKeyFor(input.scope, entry.categoryId, entry.promptExternalId),
      evaluationCount: evals.length,
      aggregateScore: agg.aggregate,
      normalizedScore: agg.normalized,
      medianScore: agg.median,
      dispersion: agg.dispersion,
      coverageStatus,
      preliminaryPosition: null,
      tieGroup: null,
      resultStatus: coverageStatus === "COMPLETE" ? "RANKED" : "REVIEW_REQUIRED",
      flags,
      engineVersion: RANKING_ENGINE_VERSION,
      ruleSetVersion: input.rules.ruleSetVersion,
      priorityAvg,
    });
  }

  // Agrupar por scopeKey y rankear
  const groups = new Map<string, WorkAcc[]>();
  for (const w of works) {
    const g = groups.get(w.scopeKey) ?? [];
    g.push(w);
    groups.set(w.scopeKey, g);
  }

  for (const [scopeKey, group] of groups) {
    const rankable = group.filter((w) => w.coverageStatus === "COMPLETE");
    const incomplete = group.filter((w) => w.coverageStatus !== "COMPLETE");

    rankable.sort((a, b) => {
      const cmp = compareForTieBreak(a, b, input.rules.tieBreakStrategy);
      if (cmp !== 0) return cmp;
      // Empate persistente: no usar id/inscripción — marcar tie
      return 0;
    });

    let position = 1;
    let i = 0;
    while (i < rankable.length) {
      const current = rankable[i]!;
      let j = i + 1;
      while (
        j < rankable.length &&
        compareForTieBreak(current, rankable[j]!, input.rules.tieBreakStrategy) === 0
      ) {
        j += 1;
      }
      const tieSize = j - i;
      if (tieSize > 1) {
        const tieGroup = `${scopeKey}:tie:${position}`;
        for (let k = i; k < j; k++) {
          const w = rankable[k]!;
          w.preliminaryPosition = position;
          w.tieGroup = tieGroup;
          w.resultStatus =
            input.rules.tieBreakStrategy === "SHARED_TIE" ? "TIED" : "TIED";
          w.flags.push(
            input.rules.tieBreakStrategy === "MANUAL_ONLY" ||
              compareForTieBreak(current, rankable[k]!, input.rules.tieBreakStrategy) === 0
              ? "MANUAL_TIEBREAK_REQUIRED"
              : "TIED",
          );
          if (!w.flags.includes("MANUAL_TIEBREAK_REQUIRED")) {
            w.flags.push("MANUAL_TIEBREAK_REQUIRED");
          }
        }
      } else {
        current.preliminaryPosition = position;
        current.resultStatus = "RANKED";
      }
      position += tieSize;
      i = j;
    }

    for (const w of incomplete) {
      w.preliminaryPosition = null;
      w.resultStatus = "REVIEW_REQUIRED";
    }
  }

  // Orden estable de salida: scopeKey + position + anonymousCode (solo para orden de lista, no desempate)
  const output = works
    .map((w) => {
      const { priorityAvg, ...rest } = w;
      void priorityAvg;
      return rest;
    })
    .sort((a, b) => {
      if (a.scopeKey !== b.scopeKey) return a.scopeKey.localeCompare(b.scopeKey);
      const pa = a.preliminaryPosition ?? 999999;
      const pb = b.preliminaryPosition ?? 999999;
      if (pa !== pb) return pa - pb;
      return a.anonymousCode.localeCompare(b.anonymousCode);
    });

  return { works: output, engineVersion: RANKING_ENGINE_VERSION };
}

/** Asigna premios preliminares sin publicar. */
export function assignPreliminaryAwards(
  works: RankedWork[],
  winnersPerScope: number,
): Array<RankedWork & { awardType: "FIRST_PLACE" | "SECOND_PLACE" | "THIRD_PLACE" | "FINALIST" | null }> {
  const byScope = new Map<string, RankedWork[]>();
  for (const w of works) {
    if (w.coverageStatus !== "COMPLETE" || w.preliminaryPosition == null) continue;
    if (w.flags.includes("MANUAL_TIEBREAK_REQUIRED")) continue;
    const list = byScope.get(w.scopeKey) ?? [];
    list.push(w);
    byScope.set(w.scopeKey, list);
  }

  const out: Array<RankedWork & { awardType: "FIRST_PLACE" | "SECOND_PLACE" | "THIRD_PLACE" | "FINALIST" | null }> = [];
  for (const w of works) {
    let awardType: "FIRST_PLACE" | "SECOND_PLACE" | "THIRD_PLACE" | "FINALIST" | null = null;
    if (
      w.coverageStatus === "COMPLETE" &&
      w.preliminaryPosition != null &&
      !w.flags.includes("MANUAL_TIEBREAK_REQUIRED") &&
      w.preliminaryPosition <= winnersPerScope
    ) {
      if (w.preliminaryPosition === 1) awardType = "FIRST_PLACE";
      else if (w.preliminaryPosition === 2) awardType = "SECOND_PLACE";
      else if (w.preliminaryPosition === 3) awardType = "THIRD_PLACE";
      else awardType = "FINALIST";
    }
    out.push({ ...w, awardType });
  }
  return out;
}
