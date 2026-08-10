/**
 * ETAPA 16A — Calculador de capacidad de jurado (genérico FotoRank).
 * Puro / sin Prisma — ver docs/fotorank/jury-capacity-calculator-spec.md y §6 master rules.
 * No bloqueante: nunca impide publicar ni abrir un concurso; solo recomienda.
 * Unidad de carga = 1 obra asignada a 1 jurado ("1 foto + criterios = 1 unidad de carga").
 */

export type JurySemaphore = "green" | "amber" | "red";
/** Alias en mayúsculas (mismos valores; conveniencia para copy / logs). */
export type JuryLoadSemaphore = "GREEN" | "YELLOW" | "RED";

export const CAPACITY_CALCULATOR_DEFAULTS = {
  /** 1 foto + N criterios = 1 unidad de carga (no N unidades por criterio). */
  recommendedMaxEntriesPerJudge: 500,
  requiredEvaluationsPerEntry: 3,
  yellowLoadThreshold: 501,
  redLoadThreshold: 651,
} as const;

export type CapacityCalculatorInput = {
  /** Universo bruto de fotos/obras estimadas o reales. */
  estimatedEntries: number;
  /** Evaluaciones independientes requeridas por foto (default Clickatón: 3). */
  requiredEvaluationsPerEntry?: number;
  /** Alias de `requiredEvaluationsPerEntry` (compatibilidad con `minimumEvaluationsPerEntry` de la sesión). */
  minimumEvaluationsPerEntry?: number;
  /** Carga objetivo por jurado (fotos evaluadas). Default: 500. */
  recommendedMaxEntriesPerJudge?: number;
  /** Jurados con invitación ACEPTADA (disponibles reales). */
  acceptedJudges: number;
  /** Umbral de carga media por jurado desde el cual el semáforo pasa a amber/YELLOW. */
  yellowLoadThreshold?: number;
  /** Umbral de carga media por jurado desde el cual el semáforo pasa a red/RED. */
  redLoadThreshold?: number;
};
export type JuryCapacityInput = CapacityCalculatorInput;

export type CapacityCalculatorResult = {
  estimatedEntries: number;
  /** Alias de `estimatedEntries` para callers que esperan `maxEntries`. */
  maxEntries: number;
  requiredEvaluationsPerEntry: number;
  recommendedMaxEntriesPerJudge: number;
  yellowLoadThreshold: number;
  redLoadThreshold: number;
  acceptedJudges: number;
  totalAssignmentUnits: number;
  /** Alias de `totalAssignmentUnits`. */
  totalEvaluations: number;
  /** ceil(totalAssignmentUnits / recommendedMaxEntriesPerJudge). */
  recommendedJudges: number;
  /** max(0, recommendedJudges - acceptedJudges). */
  deficit: number;
  /** totalAssignmentUnits / acceptedJudges; null si aún no hay jurados aceptados. */
  loadPerJudge: number | null;
  semaphore: JurySemaphore;
  /** Copy en lenguaje natural, no bloqueante ("Recomendación — no bloquea la publicación"). */
  explanation: string;
};
export type JuryCapacityResult = CapacityCalculatorResult;

/**
 * Calcula la capacidad de jurado recomendada. Nunca lanza; siempre devuelve un resultado
 * (recomendación no bloqueante), sanitizando entradas negativas/NaN a 0.
 */
export function computeJuryCapacity(input: CapacityCalculatorInput): CapacityCalculatorResult {
  const estimatedEntries = sanitizeNonNegativeInt(input.estimatedEntries);
  const requiredEvaluationsPerEntry = sanitizePositiveInt(
    input.requiredEvaluationsPerEntry ?? input.minimumEvaluationsPerEntry,
    CAPACITY_CALCULATOR_DEFAULTS.requiredEvaluationsPerEntry,
  );
  const recommendedMaxEntriesPerJudge = sanitizePositiveInt(
    input.recommendedMaxEntriesPerJudge,
    CAPACITY_CALCULATOR_DEFAULTS.recommendedMaxEntriesPerJudge,
  );
  const acceptedJudges = sanitizeNonNegativeInt(input.acceptedJudges);
  const yellowLoadThreshold = sanitizePositiveInt(
    input.yellowLoadThreshold,
    CAPACITY_CALCULATOR_DEFAULTS.yellowLoadThreshold,
  );
  const redLoadThreshold = sanitizePositiveInt(
    input.redLoadThreshold,
    CAPACITY_CALCULATOR_DEFAULTS.redLoadThreshold,
  );

  const totalAssignmentUnits = estimatedEntries * requiredEvaluationsPerEntry;
  const recommendedJudges =
    totalAssignmentUnits === 0 ? 0 : Math.ceil(totalAssignmentUnits / recommendedMaxEntriesPerJudge);
  const deficit = Math.max(0, recommendedJudges - acceptedJudges);
  const loadPerJudge = acceptedJudges > 0 ? totalAssignmentUnits / acceptedJudges : null;

  let semaphore: JurySemaphore = "green";
  if (acceptedJudges === 0 && totalAssignmentUnits > 0) {
    semaphore = "red"; // hay trabajo por asignar y todavía ningún jurado aceptado
  } else if (loadPerJudge != null && loadPerJudge >= redLoadThreshold) {
    semaphore = "red";
  } else if (loadPerJudge != null && loadPerJudge >= yellowLoadThreshold) {
    semaphore = "amber";
  }

  const explanation = buildExplanation({
    estimatedEntries,
    requiredEvaluationsPerEntry,
    totalAssignmentUnits,
    recommendedMaxEntriesPerJudge,
    recommendedJudges,
    acceptedJudges,
    deficit,
    loadPerJudge,
    semaphore,
  });

  return {
    estimatedEntries,
    maxEntries: estimatedEntries,
    requiredEvaluationsPerEntry,
    recommendedMaxEntriesPerJudge,
    yellowLoadThreshold,
    redLoadThreshold,
    acceptedJudges,
    totalAssignmentUnits,
    totalEvaluations: totalAssignmentUnits,
    recommendedJudges,
    deficit,
    loadPerJudge,
    semaphore,
    explanation,
  };
}

function buildExplanation(v: {
  estimatedEntries: number;
  requiredEvaluationsPerEntry: number;
  totalAssignmentUnits: number;
  recommendedMaxEntriesPerJudge: number;
  recommendedJudges: number;
  acceptedJudges: number;
  deficit: number;
  loadPerJudge: number | null;
  semaphore: JurySemaphore;
}): string {
  const base =
    `${v.estimatedEntries} obras × ${v.requiredEvaluationsPerEntry} evaluaciones/obra = ` +
    `${v.totalAssignmentUnits} evaluaciones totales. ` +
    `Recomendado: ${v.recommendedJudges} jurados (carga objetivo ${v.recommendedMaxEntriesPerJudge}/jurado). ` +
    `Aceptados: ${v.acceptedJudges}` +
    (v.loadPerJudge != null ? ` · carga media ${round2(v.loadPerJudge)}/jurado.` : " · sin jurados aceptados aún.");
  if (v.deficit > 0) {
    return `${base} Déficit: ${v.deficit} jurados adicionales sugeridos. Recomendación — no bloquea la publicación.`;
  }
  if (v.semaphore === "red") {
    return `${base} Carga excesiva; conviene convocar más jurados. Recomendación — no bloquea la publicación.`;
  }
  if (v.semaphore === "amber") {
    return `${base} Carga elevada; monitorear ritmo de evaluación. Recomendación — no bloquea la publicación.`;
  }
  return `${base} Carga razonable. Recomendación — no bloquea la publicación.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sanitizeNonNegativeInt(value: number | undefined | null): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

function sanitizePositiveInt(value: number | undefined | null, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}
