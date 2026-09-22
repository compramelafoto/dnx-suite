/**
 * Los números de la encuesta. Funciones puras: entran valores, sale el cálculo.
 */
import { ASPECT_MAX, ASPECT_MIN, NPS_MAX, NPS_MIN } from "./survey-definition.ts";

export type NpsBreakdown = {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** Promotores menos detractores, en porcentaje, redondeado. */
  score: number;
};

/**
 * NPS clásico: 9-10 promotor, 7-8 pasivo, 0-6 detractor.
 * Los valores fuera de 0..10 se descartan en lugar de ensuciar el total.
 */
export function calculateNps(scores: readonly number[]): NpsBreakdown {
  const valid = scores.filter(
    (n) => Number.isInteger(n) && n >= NPS_MIN && n <= NPS_MAX,
  );
  const total = valid.length;
  if (total === 0) {
    return { total: 0, promoters: 0, passives: 0, detractors: 0, score: 0 };
  }

  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const n of valid) {
    if (n >= 9) promoters += 1;
    else if (n >= 7) passives += 1;
    else detractors += 1;
  }

  return {
    total,
    promoters,
    passives,
    detractors,
    score: Math.round(((promoters - detractors) / total) * 100),
  };
}

export type AspectAverage = {
  /** null cuando nadie lo puntuó: no es lo mismo que cero. */
  average: number | null;
  answered: number;
  notApplicable: number;
};

/**
 * Promedio de un aspecto. Los "No aplica" (null) no promedian y se informan
 * aparte: un aspecto que la mitad no vivió no se juzga como si lo hubieran
 * puntuado mal.
 */
export function averageAspect(values: readonly (number | null)[]): AspectAverage {
  let sum = 0;
  let answered = 0;
  let notApplicable = 0;

  for (const value of values) {
    if (value === null || value === undefined) {
      notApplicable += 1;
      continue;
    }
    if (!Number.isFinite(value) || value < ASPECT_MIN || value > ASPECT_MAX) {
      notApplicable += 1;
      continue;
    }
    sum += value;
    answered += 1;
  }

  if (answered === 0) return { average: null, answered: 0, notApplicable };
  return {
    average: Math.round((sum / answered) * 10) / 10,
    answered,
    notApplicable,
  };
}

export type WouldReturnBreakdown = {
  yes: number;
  maybe: number;
  no: number;
  answered: number;
  /** "Sí" y "tal vez" sobre el total de quienes contestaron. */
  positiveRate: number;
};

export function wouldReturnRate(
  values: readonly ("YES" | "MAYBE" | "NO" | null)[],
): WouldReturnBreakdown {
  let yes = 0;
  let maybe = 0;
  let no = 0;

  for (const value of values) {
    if (value === "YES") yes += 1;
    else if (value === "MAYBE") maybe += 1;
    else if (value === "NO") no += 1;
  }

  const answered = yes + maybe + no;
  if (answered === 0) {
    return { yes: 0, maybe: 0, no: 0, answered: 0, positiveRate: 0 };
  }

  return {
    yes,
    maybe,
    no,
    answered,
    positiveRate: Math.round(((yes + maybe) / answered) * 100),
  };
}
