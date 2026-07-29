export type {
  RecommendationContentType,
  RecommendationSource,
  RecommendationItem,
  RecommendationContext,
  RecommendationExplain,
  RecommendationExplainFactor,
  RankedRecommendation,
  RecommendationEngineOptions,
} from "./types";
export {
  RECOMMENDATION_CONTENT_TYPES,
  RECOMMENDATION_SOURCES,
} from "./types";

export {
  RECOMMENDATION_WEIGHTS,
  RECOMMENDATION_THRESHOLDS,
  RECOMMENDATION_LIMITS,
  RECOMMENDATION_BOOSTS,
  RECOMMENDATION_PENALTIES,
  CONTENT_TYPE_AFFINITY,
  DEFAULT_EXCLUDED_TYPES,
} from "./config";

export {
  RecommendationEngine,
  createRecommendationEngine,
} from "./engine";

export { scoreRecommendationCandidate } from "./score";

export * from "./adapters/index";
