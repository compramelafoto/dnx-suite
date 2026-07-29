/**
 * RecommendationEngine — ranking puro de candidatos.
 */

import {
  RECOMMENDATION_LIMITS,
  RECOMMENDATION_THRESHOLDS,
} from "./config";
import { scoreRecommendationCandidate } from "./score";
import type {
  RankedRecommendation,
  RecommendationContext,
  RecommendationEngineOptions,
  RecommendationItem,
} from "./types";

function passesBlockFilter(
  item: RecommendationItem,
  ctx: RecommendationContext,
  distanceKm: number | null,
  now: Date,
): boolean {
  const block = ctx.block ?? "all";
  switch (block) {
    case "nearby":
      if (distanceKm == null) return false;
      if (ctx.radiusKm != null && distanceKm > ctx.radiusKm) return false;
      return true;
    case "upcoming_events":
      if (item.contentType !== "EVENT" && item.contentType !== "CONTEST") {
        return false;
      }
      if (item.isFinished) return false;
      if (item.startsAt) {
        const t = new Date(item.startsAt).getTime();
        if (Number.isFinite(t) && t < now.getTime() - 12 * 3_600_000) return false;
      }
      return true;
    case "open_calls":
      return item.contentType === "PHOTOGRAPHER_CALL" && item.isOpenCall === true;
    case "coverages":
      return item.contentType === "COVERAGE" || item.contentType === "GALLERY";
    case "similar":
    case "all":
    default:
      return true;
  }
}

export class RecommendationEngine {
  constructor(private readonly options: RecommendationEngineOptions = {}) {}

  /**
   * Rankea candidatos respecto al contexto/seed.
   * No ejecuta I/O — la app carga candidatos.
   */
  recommend(
    candidates: RecommendationItem[],
    context: RecommendationContext = {},
  ): RankedRecommendation[] {
    const now = context.now ?? new Date();
    const thresholds = {
      ...RECOMMENDATION_THRESHOLDS,
      ...this.options.thresholds,
    };
    const limits = { ...RECOMMENDATION_LIMITS, ...this.options.limits };
    const limit = Math.min(
      limits.max,
      Math.max(1, context.limit ?? this.blockDefaultLimit(context.block) ?? limits.default),
    );

    const ranked: RankedRecommendation[] = [];

    for (const item of candidates) {
      const scored = scoreRecommendationCandidate(item, context, this.options);
      if (scored.excluded) continue;
      if (!passesBlockFilter(item, context, scored.distanceKm, now)) continue;
      if (scored.score < thresholds.minScore) continue;
      ranked.push({
        item: scored.item,
        score: scored.score,
        distanceKm: scored.distanceKm,
        explain: scored.explain,
      });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = a.distanceKm;
      const db = b.distanceKm;
      if (da != null && db != null && da !== db) return da - db;
      const ta = a.item.publishedAt
        ? new Date(a.item.publishedAt).getTime()
        : 0;
      const tb = b.item.publishedAt
        ? new Date(b.item.publishedAt).getTime()
        : 0;
      if (tb !== ta) return tb - ta;
      return a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0;
    });

    return ranked.slice(0, limit);
  }

  private blockDefaultLimit(
    block: RecommendationContext["block"],
  ): number | undefined {
    const limits = { ...RECOMMENDATION_LIMITS, ...this.options.limits };
    switch (block) {
      case "similar":
        return limits.similar;
      case "nearby":
        return limits.nearby;
      case "upcoming_events":
        return limits.upcoming;
      case "open_calls":
        return limits.openCalls;
      case "coverages":
        return limits.coverages;
      default:
        return limits.default;
    }
  }
}

export function createRecommendationEngine(
  options?: RecommendationEngineOptions,
): RecommendationEngine {
  return new RecommendationEngine(options);
}
