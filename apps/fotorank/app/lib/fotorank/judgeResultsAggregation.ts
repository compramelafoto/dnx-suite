/**
 * FotoRank — Agregación de resultados (votos de jurado → ranking por categoría)
 * =============================================================================
 *
 * Fuente de datos: `FotorankJudgeVote` unido a `FotorankContestEntry` (canónico).
 * No usar el modelo legacy `Entry` de ComprameLaFoto.
 *
 * -----------------------------------------------------------------------------
 * Alcance por categoría
 * -----------------------------------------------------------------------------
 * Se consideran todas las asignaciones (`FotorankJudgeAssignment`) del par
 * (contestId, categoryId). Debe existir **un único** `methodType` entre ellas.
 * Si hay más de uno, no se calcula un ranking consolidado (estado explícito
 * AMBIGUOUS_METHOD en la capa de datos).
 *
 * -----------------------------------------------------------------------------
 * Convención por methodType (sin ambigüedad silenciosa)
 * -----------------------------------------------------------------------------
 *
 * 1) SCORE_1_5, SCORE_1_10, SCORE_0_100
 *    - Valor por voto: `valueNumeric` (omitir votos sin número finito).
 *    - Agregado por obra: **media aritmética** de esos valores.
 *    - Orden: **mayor** puntaje primero.
 *
 * 2) YES_NO
 *    - Valor por voto: Sí → 1, No → 0 (omitir si `valueBoolean` es null/undefined).
 *    - Agregado por obra: **media** (tasa de “sí” en 0–1).
 *    - Orden: **mayor** tasa primero. Presentación sugerida: porcentaje.
 *
 * 3) FAVORITES_SELECTION
 *    - Valor por voto: favorita → 1, no favorita → 0.
 *    - Agregado por obra: **suma** (conteo de jurados que marcaron favorito).
 *    - Orden: **mayor** suma primero.
 *
 * 4) SELECTION_WITH_QUOTA
 *    - Valor por voto: `selectedRank` entero ≥ 1 (omitir inválidos).
 *    - Significado: posición asignada por el jurado (1 = mejor puesto en su lista).
 *    - Agregado por obra: **media** de rangos.
 *    - Orden: **menor** media primero (mejor posición promedio gana).
 *
 * 5) CRITERIA_BASED
 *    - Valor por voto: media aritmética de **todos** los valores numéricos en
 *      `criteriaScoresJson` (peso igual por clave presente en el JSON).
 *      Nota: en operación normal las claves coinciden con los criterios configurados;
 *      si el JSON estuviera incompleto, solo se promedian números válidos encontrados.
 *    - Agregado por obra: **media** de esas medias por voto.
 *    - Orden: **mayor** agregado primero.
 *
 * -----------------------------------------------------------------------------
 * Obras sin votos válidos
 * -----------------------------------------------------------------------------
 * Aparecen en la lista con `aggregateScore === null` y `voteCount === 0` (o solo
 * votos inválidos para el método → equivalente a sin contribuciones). Se ordenan
 * al final (detalle en `rankEntriesForCategory`).
 */

/**
 * Alineado con el enum Prisma `FotorankJudgeMethodType` (no importable de `@prisma/client`
 * en este workspace sin depender del cliente generado en la app).
 */
export type FotorankJudgeMethodType =
  | "SCORE_1_5"
  | "SCORE_1_10"
  | "SCORE_0_100"
  | "YES_NO"
  | "FAVORITES_SELECTION"
  | "SELECTION_WITH_QUOTA"
  | "CRITERIA_BASED";

export type VoteSnapshotForResults = {
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  isFavorite: boolean | null;
  selectedRank: number | null;
  criteriaScoresJson: unknown;
};

export type AggregationSortMode = "higher_is_better" | "lower_is_better";

/** Solo FAVORITES usa suma; el resto usa media de contribuciones por voto. */
export function usesSumAggregation(methodType: FotorankJudgeMethodType): boolean {
  return methodType === "FAVORITES_SELECTION";
}

export function sortModeForMethod(methodType: FotorankJudgeMethodType): AggregationSortMode {
  return methodType === "SELECTION_WITH_QUOTA" ? "lower_is_better" : "higher_is_better";
}

/**
 * Extrae un escalar por voto según el método. `null` = voto no aporta al agregado.
 */
export function extractScalarContribution(
  methodType: FotorankJudgeMethodType,
  vote: VoteSnapshotForResults,
): number | null {
  switch (methodType) {
    case "SCORE_1_5":
    case "SCORE_1_10":
    case "SCORE_0_100": {
      const n = vote.valueNumeric;
      if (n == null || !Number.isFinite(n)) return null;
      return n;
    }
    case "YES_NO": {
      const b = vote.valueBoolean;
      if (b === null || b === undefined) return null;
      return b ? 1 : 0;
    }
    case "FAVORITES_SELECTION": {
      const f = vote.isFavorite;
      if (f === null || f === undefined) return null;
      return f ? 1 : 0;
    }
    case "SELECTION_WITH_QUOTA": {
      const r = vote.selectedRank;
      if (r == null || !Number.isFinite(r) || r < 1) return null;
      return r;
    }
    case "CRITERIA_BASED": {
      const j = vote.criteriaScoresJson;
      if (j === null || j === undefined || typeof j !== "object" || Array.isArray(j)) return null;
      const nums = Object.values(j as Record<string, unknown>)
        .map((v) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
      if (nums.length === 0) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    }
  }
}

export function foldContributions(
  methodType: FotorankJudgeMethodType,
  contributions: number[],
): { aggregateScore: number | null; voteCount: number } {
  const n = contributions.length;
  if (n === 0) return { aggregateScore: null, voteCount: 0 };
  if (usesSumAggregation(methodType)) {
    const sum = contributions.reduce((a, b) => a + b, 0);
    return { aggregateScore: sum, voteCount: n };
  }
  const mean = contributions.reduce((a, b) => a + b, 0) / n;
  return { aggregateScore: mean, voteCount: n };
}

export type EntryRowForRanking = {
  entryId: string;
  title: string | null;
  imageUrl: string;
  contributions: number[];
};

export type RankedEntryResult = {
  entryId: string;
  title: string | null;
  imageUrl: string;
  aggregateScore: number | null;
  voteCount: number;
  /** Posición 1-based después de ordenar (empates: mismo número consecutivo tipo 1,1,3). */
  rankPosition: number;
};

function assignRanks(sorted: Array<{ aggregateScore: number | null; voteCount: number }>): number[] {
  const ranks: number[] = [];
  let pos = 0;
  let lastKey: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const key =
      row.aggregateScore === null
        ? "null"
        : `${row.aggregateScore.toFixed(6)}|${row.voteCount}`;
    if (key !== lastKey) {
      pos = i + 1;
      lastKey = key;
    }
    ranks.push(pos);
  }
  return ranks;
}

/**
 * Ordena entradas: primero las que tienen puntaje, luego sin votos válidos.
 * Desempate: más votos primero cuando el criterio principal empató.
 */
export function rankEntriesForCategory(
  methodType: FotorankJudgeMethodType,
  entries: EntryRowForRanking[],
): RankedEntryResult[] {
  const sortMode = sortModeForMethod(methodType);
  const withScores = entries.map((e) => {
    const { aggregateScore, voteCount } = foldContributions(methodType, e.contributions);
    return {
      entryId: e.entryId,
      title: e.title,
      imageUrl: e.imageUrl,
      aggregateScore,
      voteCount,
      _hasScore: aggregateScore !== null,
    };
  });

  withScores.sort((a, b) => {
    if (a._hasScore !== b._hasScore) return a._hasScore ? -1 : 1;
    if (!a._hasScore && !b._hasScore) {
      return (a.title ?? "").localeCompare(b.title ?? "", "es");
    }
    const sa = a.aggregateScore!;
    const sb = b.aggregateScore!;
    if (sa !== sb) {
      return sortMode === "lower_is_better" ? sa - sb : sb - sa;
    }
    if (a.voteCount !== b.voteCount) return b.voteCount - a.voteCount;
    return a.entryId.localeCompare(b.entryId);
  });

  const ranks = assignRanks(
    withScores.map((r) => ({ aggregateScore: r.aggregateScore, voteCount: r.voteCount })),
  );

  return withScores.map((r, i) => ({
    entryId: r.entryId,
    title: r.title,
    imageUrl: r.imageUrl,
    aggregateScore: r.aggregateScore,
    voteCount: r.voteCount,
    rankPosition: ranks[i]!,
  }));
}

export function humanizeAggregateLabel(methodType: FotorankJudgeMethodType): string {
  switch (methodType) {
    case "SCORE_1_5":
    case "SCORE_1_10":
    case "SCORE_0_100":
      return "Promedio de puntaje";
    case "YES_NO":
      return "Tasa de «sí» (promedio 0–1)";
    case "FAVORITES_SELECTION":
      return "Total de favoritos (suma de jurados)";
    case "SELECTION_WITH_QUOTA":
      return "Ranking medio (menor es mejor)";
    case "CRITERIA_BASED":
      return "Promedio de medias por criterio";
    default:
      return "Puntaje agregado";
  }
}

export function formatAggregateDisplay(
  methodType: FotorankJudgeMethodType,
  aggregateScore: number | null,
): string {
  if (aggregateScore === null) return "—";
  switch (methodType) {
    case "YES_NO":
      return `${(aggregateScore * 100).toFixed(1)}% sí`;
    case "FAVORITES_SELECTION":
      return `${Math.round(aggregateScore)}`;
    case "SELECTION_WITH_QUOTA":
      return aggregateScore.toFixed(2);
    case "CRITERIA_BASED":
    case "SCORE_1_5":
    case "SCORE_1_10":
    case "SCORE_0_100":
      return aggregateScore.toFixed(2);
    default:
      return String(aggregateScore);
  }
}

export function sortExplanation(methodType: FotorankJudgeMethodType): string {
  if (methodType === "SELECTION_WITH_QUOTA") {
    return "Orden: mejor promedio de posición (número más bajo). Sin puntaje válido al final.";
  }
  return "Orden: mayor puntaje agregado primero. Sin puntaje válido al final.";
}
