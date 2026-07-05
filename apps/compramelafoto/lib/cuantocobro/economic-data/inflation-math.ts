import type { EconomicDataMonthlyPoint } from "./economic-data-types";

/** Convierte valor decimal de datos.gob.ar (0.0341) a % mensual (3.41). */
export function decimalToMonthlyPercent(decimalValue: number): number {
  return decimalValue * 100;
}

/** Promedio de los últimos N puntos (más recientes primero). */
export function averageLastMonths(points: EconomicDataMonthlyPoint[], months: number): number | null {
  if (points.length === 0 || months <= 0) return null;
  const slice = points.slice(0, Math.min(months, points.length));
  const sum = slice.reduce((acc, point) => acc + point.monthlyRatePercent, 0);
  return sum / slice.length;
}

/** Tasa anual compuesta a partir de una tasa mensual en %. */
export function compoundAnnualRateFromMonthly(monthlyRatePercent: number): number {
  const monthlyFactor = 1 + monthlyRatePercent / 100;
  return (Math.pow(monthlyFactor, 12) - 1) * 100;
}

export function parseDatosGobArPercentChangeSeries(
  data: unknown,
): EconomicDataMonthlyPoint[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const record = data as { data?: unknown };
  if (!Array.isArray(record.data)) return [];

  const points: EconomicDataMonthlyPoint[] = [];

  for (const row of record.data) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const period = String(row[0]);
    const raw = Number(row[1]);
    if (!period || !Number.isFinite(raw)) continue;
    points.push({
      period,
      monthlyRatePercent: decimalToMonthlyPercent(raw),
    });
  }

  return points.sort((a, b) => (a.period < b.period ? 1 : -1));
}

export function buildInflationSuggestionFromPoints(
  points: EconomicDataMonthlyPoint[],
  options: {
    sourceLabel: string;
    seriesId: string;
    queriedAt: string;
  },
): {
  latestPeriod: string;
  latestMonthlyRate: number;
  average3m: number;
  average6m: number;
  average12m: number;
  suggestedMonthlyRate: number;
  suggestedAnnualRate: number;
} | null {
  if (points.length === 0) return null;

  const latest = points[0];
  const avg3 = averageLastMonths(points, 3);
  const avg6 = averageLastMonths(points, 6);
  const avg12 = averageLastMonths(points, 12);
  const suggestedMonthly = avg6 ?? avg3 ?? latest.monthlyRatePercent;

  return {
    latestPeriod: latest.period,
    latestMonthlyRate: latest.monthlyRatePercent,
    average3m: avg3 ?? latest.monthlyRatePercent,
    average6m: avg6 ?? suggestedMonthly,
    average12m: avg12 ?? suggestedMonthly,
    suggestedMonthlyRate: suggestedMonthly,
    suggestedAnnualRate: compoundAnnualRateFromMonthly(suggestedMonthly),
  };
}
