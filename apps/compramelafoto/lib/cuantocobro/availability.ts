import { parseCuantoCobroAmount } from "@/lib/cuantocobro/amount-format";
import type { CuantoCobroProfileInput, PhotographyTimeDistribution } from "@/lib/cuantocobro/types";

export const WEEKS_PER_MONTH = 4.33;

export const PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS = [
  "coverage",
  "editing",
  "administration",
  "sales",
  "marketing",
  "training",
] as const satisfies readonly (keyof PhotographyTimeDistribution)[];

export const PHOTOGRAPHY_TIME_DISTRIBUTION_LABELS: Record<keyof PhotographyTimeDistribution, string> = {
  coverage: "Coberturas fotográficas",
  editing: "Edición y postproducción",
  administration: "Administración",
  sales: "Presupuestos y ventas",
  marketing: "Marketing y redes sociales",
  training: "Capacitación",
};

export const DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION: PhotographyTimeDistribution = {
  coverage: "35",
  editing: "30",
  administration: "12",
  sales: "8",
  marketing: "10",
  training: "5",
};

export function parseTimeDistributionPercent(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return parsed;
}

export const TIME_DISTRIBUTION_STEP = 5;

export function snapTimeDistributionStep(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value / TIME_DISTRIBUTION_STEP) * TIME_DISTRIBUTION_STEP));
}

export function sumTimeDistributionPercentages(distribution: PhotographyTimeDistribution): number {
  return PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS.reduce((total, key) => {
    return total + (parseTimeDistributionPercent(distribution[key]) ?? 0);
  }, 0);
}

export function getTimeDistributionGap(distribution: PhotographyTimeDistribution): {
  remaining: number;
  overflow: number;
} {
  const total = sumTimeDistributionPercentages(distribution);
  return {
    remaining: Math.max(0, Math.round((100 - total) * 10) / 10),
    overflow: Math.max(0, Math.round((total - 100) * 10) / 10),
  };
}

export function setTimeDistributionPercent(
  distribution: PhotographyTimeDistribution,
  key: keyof PhotographyTimeDistribution,
  raw: string | number,
  options?: { snapToStep?: boolean },
): PhotographyTimeDistribution {
  const requested =
    typeof raw === "number"
      ? raw
      : parseTimeDistributionPercent(raw.replace(/[^\d.,]/g, "").replace(",", ".")) ?? 0;
  let next = Math.min(100, Math.max(0, requested));
  if (options?.snapToStep) {
    next = snapTimeDistributionStep(next);
  }
  return {
    ...distribution,
    [key]: String(next),
  };
}

export function computeWeeklyHoursForPercent(weeklyHours: number, percent: number): number {
  if (weeklyHours <= 0 || percent <= 0) return 0;
  return Math.round((weeklyHours * percent) / 100);
}

export function getCategoryWeeklyHours(
  weeklyTotal: number,
  distribution: PhotographyTimeDistribution,
  key: keyof PhotographyTimeDistribution,
): number {
  const percent = parseTimeDistributionPercent(distribution[key]) ?? 0;
  return computeWeeklyHoursForPercent(weeklyTotal, percent);
}

export function sumDistributionWeeklyHours(
  weeklyTotal: number,
  distribution: PhotographyTimeDistribution,
): number {
  return PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS.reduce(
    (total, key) => total + getCategoryWeeklyHours(weeklyTotal, distribution, key),
    0,
  );
}

export function getDisplayPercentForCategoryHours(weeklyTotal: number, categoryHours: number): number {
  if (weeklyTotal <= 0 || categoryHours <= 0) return 0;
  return Math.round((categoryHours / weeklyTotal) * 100);
}

export function setTimeDistributionWeeklyHours(
  distribution: PhotographyTimeDistribution,
  key: keyof PhotographyTimeDistribution,
  categoryHours: number,
  weeklyTotal: number,
): PhotographyTimeDistribution {
  const clampedHours = Math.min(weeklyTotal, Math.max(0, Math.round(categoryHours)));
  const percent = weeklyTotal > 0 ? getDisplayPercentForCategoryHours(weeklyTotal, clampedHours) : 0;
  return {
    ...distribution,
    [key]: String(percent),
  };
}

export function getTimeDistributionHoursGap(
  weeklyTotal: number,
  distribution: PhotographyTimeDistribution,
): { remaining: number; overflow: number } {
  const assigned = sumDistributionWeeklyHours(weeklyTotal, distribution);
  return {
    remaining: Math.max(0, weeklyTotal - assigned),
    overflow: Math.max(0, assigned - weeklyTotal),
  };
}

export function getRemainingTimeDistributionPercent(distribution: PhotographyTimeDistribution): number {
  return getTimeDistributionGap(distribution).remaining;
}

export function isTimeDistributionComplete(distribution: PhotographyTimeDistribution): boolean {
  return PHOTOGRAPHY_TIME_DISTRIBUTION_KEYS.every(
    (key) => parseTimeDistributionPercent(distribution[key]) !== null,
  );
}

export function isTimeDistributionValid(
  distribution: PhotographyTimeDistribution,
  weeklyTotal = 0,
): boolean {
  if (!isTimeDistributionComplete(distribution)) return false;
  if (weeklyTotal > 0) {
    return sumDistributionWeeklyHours(weeklyTotal, distribution) === weeklyTotal;
  }
  return Math.abs(sumTimeDistributionPercentages(distribution) - 100) < 0.01;
}

export function getCoveragePercentage(distribution: PhotographyTimeDistribution): number {
  return parseTimeDistributionPercent(distribution.coverage) ?? 0;
}

export function computeMonthlyAvailableHours(weeklyHours: string): number {
  const weekly = parseCuantoCobroAmount(weeklyHours) ?? 0;
  return weekly * WEEKS_PER_MONTH;
}

export function computeMonthlyBillableHours(
  weeklyHours: string,
  distribution: PhotographyTimeDistribution,
): number {
  const weeklyTotal = Math.round(parseCuantoCobroAmount(weeklyHours) ?? 0);
  const monthlyHours = computeMonthlyAvailableHours(weeklyHours);
  if (weeklyTotal <= 0) return 0;
  const coverageHours = getCategoryWeeklyHours(weeklyTotal, distribution, "coverage");
  return monthlyHours * (coverageHours / weeklyTotal);
}

export function mergeTimeDistribution(
  saved: PhotographyTimeDistribution | undefined,
): PhotographyTimeDistribution {
  return {
    ...DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION,
    ...(saved ?? {}),
  };
}

export function normalizeProfileAvailability(
  profile: Partial<CuantoCobroProfileInput>,
): Pick<CuantoCobroProfileInput, "timeDistribution"> {
  return {
    timeDistribution: mergeTimeDistribution(profile.timeDistribution),
  };
}
