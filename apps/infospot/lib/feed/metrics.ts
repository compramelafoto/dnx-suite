/**
 * Métricas internas de generación del feed (desarrollo / debugging).
 */

import type { FeedGenerationMetrics, FeedLocationMode, InfoSpotFeedItem } from "./types";

export function emptyScopeCounts(): FeedGenerationMetrics["scopeCounts"] {
  return {
    local: 0,
    provincial: 0,
    national: 0,
    international: 0,
    unspecified: 0,
    unknown: 0,
  };
}

export function accumulateScope(
  counts: FeedGenerationMetrics["scopeCounts"],
  scope: string | null | undefined,
): void {
  switch (scope) {
    case "LOCAL":
      counts.local += 1;
      break;
    case "PROVINCIAL":
      counts.provincial += 1;
      break;
    case "NATIONAL":
      counts.national += 1;
      break;
    case "INTERNATIONAL":
      counts.international += 1;
      break;
    case "UNSPECIFIED":
      counts.unspecified += 1;
      break;
    default:
      counts.unknown += 1;
  }
}

export function buildFeedMetrics(input: {
  startedAt: number;
  candidatesLoaded: number;
  distanceCalculations: number;
  ranked: InfoSpotFeedItem[];
  pageSize: number;
  locationMode: FeedLocationMode;
  personalized: boolean;
}): FeedGenerationMetrics {
  const scopeCounts = emptyScopeCounts();
  let distSum = 0;
  let distN = 0;
  for (const item of input.ranked) {
    accumulateScope(scopeCounts, item.geographicScope);
    if (item.distanceKm != null && Number.isFinite(item.distanceKm)) {
      distSum += item.distanceKm;
      distN += 1;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    durationMs: Math.max(0, Date.now() - input.startedAt),
    candidatesLoaded: input.candidatesLoaded,
    distanceCalculations: input.distanceCalculations,
    itemsRanked: input.ranked.length,
    pageSize: input.pageSize,
    locationMode: input.locationMode,
    personalized: input.personalized,
    scopeCounts,
    averageDistanceKm: distN > 0 ? distSum / distN : null,
  };
}

/** Log seguro en desarrollo (sin coords). */
export function logFeedMetricsDev(metrics: FeedGenerationMetrics): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[infospot:feed:metrics]", {
    durationMs: metrics.durationMs,
    candidates: metrics.candidatesLoaded,
    ranked: metrics.itemsRanked,
    distanceCalcs: metrics.distanceCalculations,
    avgKm: metrics.averageDistanceKm,
    scopes: metrics.scopeCounts,
    mode: metrics.locationMode,
  });
}
