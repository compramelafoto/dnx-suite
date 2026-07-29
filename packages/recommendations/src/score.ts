import { distanceKm } from "@repo/geo/distance";
import {
  CONTENT_TYPE_AFFINITY,
  RECOMMENDATION_BOOSTS,
  RECOMMENDATION_PENALTIES,
  RECOMMENDATION_THRESHOLDS,
  RECOMMENDATION_WEIGHTS,
} from "./config";
import type {
  RecommendationContext,
  RecommendationExplain,
  RecommendationExplainFactor,
  RecommendationItem,
  RecommendationEngineOptions,
} from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tagJaccard(a: string[] | undefined, b: string[] | undefined): number {
  const sa = new Set((a ?? []).map(normalizeToken).filter(Boolean));
  const sb = new Set((b ?? []).map(normalizeToken).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

function freshnessUnit(
  publishedAt: Date | string | null | undefined,
  now: Date,
  halfLifeDays: number,
): number {
  const d = toDate(publishedAt);
  if (!d) return 0.35;
  const ageHours = Math.max(0, (now.getTime() - d.getTime()) / 3_600_000);
  return clamp01(Math.exp(-ageHours / (halfLifeDays * 24)));
}

function temporalUnit(
  item: RecommendationItem,
  now: Date,
  upcomingWindowDays: number,
): number {
  const start = toDate(item.startsAt);
  if (!start) return 0.3;
  const deltaMs = start.getTime() - now.getTime();
  if (deltaMs < -12 * 3_600_000) return 0.1; // ya pasó
  const days = deltaMs / 86_400_000;
  if (days <= 0) return 1;
  if (days <= 7) return 0.9;
  if (days <= upcomingWindowDays) return clamp01(1 - days / upcomingWindowDays);
  return 0.15;
}

function resolveOrigin(
  ctx: RecommendationContext,
  seed: RecommendationItem | null | undefined,
): { latitude: number; longitude: number } | null {
  if (
    typeof ctx.userLatitude === "number" &&
    typeof ctx.userLongitude === "number" &&
    !(ctx.userLatitude === 0 && ctx.userLongitude === 0)
  ) {
    return { latitude: ctx.userLatitude, longitude: ctx.userLongitude };
  }
  if (
    seed &&
    typeof seed.latitude === "number" &&
    typeof seed.longitude === "number" &&
    !(seed.latitude === 0 && seed.longitude === 0)
  ) {
    return { latitude: seed.latitude, longitude: seed.longitude };
  }
  return null;
}

export type ScoredCandidate = {
  item: RecommendationItem;
  score: number;
  distanceKm: number | null;
  explain: RecommendationExplain;
  excluded: boolean;
};

export function scoreRecommendationCandidate(
  item: RecommendationItem,
  ctx: RecommendationContext,
  options: RecommendationEngineOptions = {},
): ScoredCandidate {
  const weights = { ...RECOMMENDATION_WEIGHTS, ...options.weights };
  const thresholds = { ...RECOMMENDATION_THRESHOLDS, ...options.thresholds };
  const boosts = { ...RECOMMENDATION_BOOSTS, ...options.boosts };
  const penalties = { ...RECOMMENDATION_PENALTIES, ...options.penalties };
  const now = ctx.now ?? new Date();
  const seed = ctx.seed ?? null;
  const factors: RecommendationExplainFactor[] = [];

  const exclude = new Set(ctx.excludeIds ?? []);
  if (seed) exclude.add(seed.id);

  if (exclude.has(item.id) || (seed && item.id === seed.id)) {
    return {
      item,
      score: -penalties.selfItem,
      distanceKm: null,
      explain: {
        factors: [
          {
            key: "self",
            label: "Contenido actual",
            value: true,
            contribution: -penalties.selfItem,
          },
        ],
        finalScore: -penalties.selfItem,
        distanceKm: null,
        summaryLines: ["Excluido: contenido actual"],
      },
      excluded: true,
    };
  }

  const excludedTypes = new Set(ctx.excludedTypes ?? []);
  if (excludedTypes.has(item.contentType)) {
    return {
      item,
      score: -penalties.excludedType,
      distanceKm: null,
      explain: {
        factors: [
          {
            key: "type",
            label: "Tipo excluido",
            value: item.contentType,
            contribution: -penalties.excludedType,
          },
        ],
        finalScore: -penalties.excludedType,
        distanceKm: null,
        summaryLines: [`Excluido: tipo ${item.contentType}`],
      },
      excluded: true,
    };
  }

  // Category
  let categoryUnit = 0;
  if (seed?.categoryId && item.categoryId && seed.categoryId === item.categoryId) {
    categoryUnit = 1;
  } else if (
    seed?.categorySlug &&
    item.categorySlug &&
    seed.categorySlug === item.categorySlug
  ) {
    categoryUnit = 0.95;
  } else if (
    ctx.favoriteCategories?.length &&
    item.categorySlug &&
    ctx.favoriteCategories.includes(item.categorySlug)
  ) {
    categoryUnit = 0.7;
  } else if (
    ctx.interestCategoryIds?.length &&
    item.categoryId &&
    ctx.interestCategoryIds.includes(item.categoryId)
  ) {
    categoryUnit = 0.65;
  }
  factors.push({
    key: "category",
    label: "Categoría coincidente",
    value: categoryUnit > 0 ? item.categorySlug ?? item.categoryId ?? true : false,
    contribution: categoryUnit * weights.category * 100,
  });

  // Tags
  const tagOverlap = Math.max(
    tagJaccard(seed?.tags, item.tags),
    tagJaccard(ctx.interestTags, item.tags),
  );
  const tagsUnit = tagOverlap;
  factors.push({
    key: "tags",
    label: "Etiquetas",
    value: Math.round(tagOverlap * 100) / 100,
    contribution: tagsUnit * weights.tags * 100,
  });

  // Geo (@repo/geo)
  const origin = resolveOrigin(ctx, seed);
  let dist: number | null = null;
  let geoUnit: number = thresholds.missingCoordsScore;
  if (
    origin &&
    typeof item.latitude === "number" &&
    typeof item.longitude === "number" &&
    !(item.latitude === 0 && item.longitude === 0)
  ) {
    dist = distanceKm(origin, {
      latitude: item.latitude,
      longitude: item.longitude,
    });
    geoUnit = clamp01(1 - dist / Math.max(1, thresholds.distanceDecayKm));
    if (ctx.radiusKm != null && dist > ctx.radiusKm && ctx.block === "nearby") {
      // Soft: nearby block will hard-filter later; still score low.
      geoUnit *= 0.15;
    }
  } else if (
    seed?.cityName &&
    item.cityName &&
    normalizeToken(seed.cityName) === normalizeToken(item.cityName)
  ) {
    geoUnit = 0.75;
  } else if (
    seed?.provinceName &&
    item.provinceName &&
    normalizeToken(seed.provinceName) === normalizeToken(item.provinceName)
  ) {
    geoUnit = 0.45;
  }
  factors.push({
    key: "geo",
    label: dist != null ? `Distancia ${Math.round(dist * 10) / 10} km` : "Cercanía",
    value: dist != null ? Math.round(dist * 10) / 10 : item.cityName ?? null,
    contribution: geoUnit * weights.geo * 100,
  });

  // Freshness
  const freshUnit = freshnessUnit(
    item.publishedAt,
    now,
    thresholds.freshnessHalfLifeDays,
  );
  factors.push({
    key: "freshness",
    label: "Actualidad",
    value: Math.round(freshUnit * 100),
    contribution: freshUnit * weights.freshness * 100,
  });

  // Priority
  const priorityUnit = clamp01((item.priority ?? 0) / 100);
  factors.push({
    key: "priority",
    label: "Prioridad editorial",
    value: item.priority ?? 0,
    contribution: priorityUnit * weights.priority * 100,
  });

  // Content type affinity
  const affinityMap = seed
    ? CONTENT_TYPE_AFFINITY[seed.contentType] ?? {}
    : {};
  const typeUnit = affinityMap[item.contentType] ?? 0.35;
  factors.push({
    key: "contentType",
    label: "Tipo de contenido",
    value: item.contentType,
    contribution: typeUnit * weights.contentType * 100,
  });

  // Popularity
  const popUnit = clamp01(item.popularity ?? 0.35);
  factors.push({
    key: "popularity",
    label: "Popularidad",
    value: Math.round(popUnit * 100),
    contribution: popUnit * weights.popularity * 100,
  });

  // Temporal proximity (events)
  const tempUnit = temporalUnit(item, now, thresholds.upcomingWindowDays);
  factors.push({
    key: "temporal",
    label: "Proximidad temporal",
    value: Math.round(tempUnit * 100),
    contribution: tempUnit * weights.temporal * 100,
  });

  // Explicit relations
  let explicitUnit = 0;
  if (
    seed &&
    item.explicitRelatedIds?.includes(seed.sourceEntityId)
  ) {
    explicitUnit = 1;
  } else if (
    seed &&
    seed.explicitRelatedIds?.includes(item.sourceEntityId)
  ) {
    explicitUnit = 1;
  }
  factors.push({
    key: "explicit",
    label: "Relación explícita",
    value: explicitUnit > 0,
    contribution: explicitUnit * weights.explicitRelation * 100,
  });

  const weightSum =
    weights.category +
    weights.tags +
    weights.geo +
    weights.freshness +
    weights.priority +
    weights.contentType +
    weights.popularity +
    weights.temporal +
    weights.explicitRelation;

  let raw =
    (categoryUnit * weights.category +
      tagsUnit * weights.tags +
      geoUnit * weights.geo +
      freshUnit * weights.freshness +
      priorityUnit * weights.priority +
      typeUnit * weights.contentType +
      popUnit * weights.popularity +
      tempUnit * weights.temporal +
      explicitUnit * weights.explicitRelation) /
    Math.max(1e-9, weightSum);

  let score = raw * 100;

  // Boosts
  if (categoryUnit >= 0.95) score += boosts.sameCategory;
  if (
    seed?.cityName &&
    item.cityName &&
    normalizeToken(seed.cityName) === normalizeToken(item.cityName)
  ) {
    score += boosts.sameCity;
    factors.push({
      key: "boostCity",
      label: seed.cityName,
      value: true,
      contribution: boosts.sameCity,
    });
  } else if (
    seed?.provinceName &&
    item.provinceName &&
    normalizeToken(seed.provinceName) === normalizeToken(item.provinceName)
  ) {
    score += boosts.sameProvince;
  }
  if (item.isOpenCall) score += boosts.openCall;
  if (explicitUnit > 0) score += boosts.explicitRelated;
  if (item.contentType === "COVERAGE") score += boosts.coverageType;

  // Penalties
  if (item.isFinished) score -= penalties.finishedEvent;
  if (item.contentType === "PHOTOGRAPHER_CALL" && item.isOpenCall === false) {
    score -= penalties.closedCall;
  }
  if (ctx.historyItemIds?.includes(item.id)) {
    score -= penalties.historySeen;
  }

  score = Math.round(score * 10) / 10;

  const summaryLines: string[] = [];
  if (categoryUnit > 0) summaryLines.push("Categoría coincidente");
  if (seed?.cityName && item.cityName && normalizeToken(seed.cityName) === normalizeToken(item.cityName)) {
    summaryLines.push(item.cityName);
  }
  if (dist != null) summaryLines.push(`Distancia ${Math.round(dist * 10) / 10} km`);
  if (freshUnit > 0.6) summaryLines.push("Publicado recientemente");
  summaryLines.push(`Score ${Math.round(score)}`);

  return {
    item,
    score,
    distanceKm: dist,
    explain: {
      factors,
      finalScore: score,
      distanceKm: dist,
      summaryLines,
    },
    excluded: false,
  };
}
