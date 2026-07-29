/**
 * Motor puro de puntuación ponderada (Etapa 14).
 * No calcula ranking ni decide ganadores.
 */

export const JURY_SCORING_ENGINE_VERSION = "clickaton-jury-scoring-v1";

export type ScoringCriterionDef = {
  key: string;
  name: string;
  weight: number;
  minScore: number;
  maxScore: number;
  step: number;
  required: boolean;
};

export type CriterionScoreInput = {
  key: string;
  score: number;
  comment?: string | null;
};

export type WeightedScoreResult = {
  ok: true;
  totalScore: number;
  normalizedScore: number;
  maxPossible: number;
  lines: Array<{
    key: string;
    name: string;
    score: number;
    weight: number;
    weightedScore: number;
  }>;
  engineVersion: string;
} | {
  ok: false;
  error: string;
  code: string;
};

function nearlyMultiple(value: number, min: number, step: number): boolean {
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) <= 1e-9;
}

export function computeWeightedScore(input: {
  criteria: ScoringCriterionDef[];
  scores: CriterionScoreInput[];
  requireAllRequired?: boolean;
}): WeightedScoreResult {
  const requireAll = input.requireAllRequired !== false;
  const byKey = new Map(input.scores.map((s) => [s.key, s]));
  const weightSum = input.criteria.reduce((a, c) => a + c.weight, 0);
  if (weightSum <= 0) {
    return { ok: false, error: "La suma de pesos debe ser > 0.", code: "WEIGHT_SUM" };
  }

  const lines: Array<{
    key: string;
    name: string;
    score: number;
    weight: number;
    weightedScore: number;
  }> = [];

  for (const c of input.criteria) {
    const row = byKey.get(c.key);
    if (!row) {
      if (c.required && requireAll) {
        return { ok: false, error: `Falta criterio obligatorio: ${c.name}`, code: "MISSING_REQUIRED" };
      }
      continue;
    }
    if (!Number.isFinite(row.score)) {
      return { ok: false, error: `Score inválido en ${c.name}`, code: "INVALID_SCORE" };
    }
    if (row.score < c.minScore || row.score > c.maxScore) {
      return {
        ok: false,
        error: `${c.name} debe estar entre ${c.minScore} y ${c.maxScore}`,
        code: "OUT_OF_RANGE",
      };
    }
    if (!nearlyMultiple(row.score, c.minScore, c.step)) {
      return {
        ok: false,
        error: `${c.name} debe respetar el paso ${c.step}`,
        code: "STEP",
      };
    }
    const weightedScore = (row.score * c.weight) / weightSum;
    lines.push({
      key: c.key,
      name: c.name,
      score: row.score,
      weight: c.weight,
      weightedScore,
    });
  }

  if (requireAll) {
    for (const c of input.criteria) {
      if (c.required && !lines.some((l) => l.key === c.key)) {
        return { ok: false, error: `Falta criterio obligatorio: ${c.name}`, code: "MISSING_REQUIRED" };
      }
    }
  }

  const totalScore = lines.reduce((a, l) => a + l.weightedScore, 0);
  const maxPossible = input.criteria.reduce(
    (a, c) => a + (c.maxScore * c.weight) / weightSum,
    0,
  );
  const normalizedScore = maxPossible > 0 ? totalScore / maxPossible : 0;

  return {
    ok: true,
    totalScore,
    normalizedScore,
    maxPossible,
    lines,
    engineVersion: JURY_SCORING_ENGINE_VERSION,
  };
}

export function computePrivateAggregates(scores: number[]): {
  count: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
} {
  if (scores.length === 0) {
    return { count: 0, average: null, median: null, min: null, max: null, stdDev: null };
  }
  const sorted = [...scores].sort((a, b) => a - b);
  const count = sorted.length;
  const average = sorted.reduce((a, b) => a + b, 0) / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const variance = sorted.reduce((a, v) => a + (v - average) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);
  return { count, average, median, min, max, stdDev };
}

/** Distribución reproducible: shuffle Fisher-Yates con seed. */
export function seededShuffleIds(ids: string[], seed: string): string[] {
  const arr = [...ids];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let i = arr.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}
