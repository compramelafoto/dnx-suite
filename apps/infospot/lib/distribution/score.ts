/**
 * Score de relevancia para destacados (transparente, extensible).
 */

export type EventScoreInput = {
  startAt: Date;
  endAt?: Date | null;
  publishedAt?: Date | null;
  coverImageUrl?: string | null;
  locationConfirmedAt?: Date | null;
  categoryId?: string | null;
  description?: string | null;
  registrationUrl?: string | null;
  editorialPriority?: number | null;
  seekingPhotographers?: boolean;
  recentViews?: number | null;
  registrationClicks?: number | null;
  now?: Date;
};

export type EventScoreBreakdown = {
  total: number;
  temporalProximityScore: number;
  geographicCompletenessScore: number;
  recentViewsScore: number;
  registrationClickScore: number;
  photographerCallBonus: number;
  editorialPriorityScore: number;
  freshnessScore: number;
  completenessScore: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function calculateEventRelevanceScore(input: EventScoreInput): EventScoreBreakdown {
  const now = input.now ?? new Date();
  const start = input.startAt.getTime();
  const daysUntil = (start - now.getTime()) / (24 * 60 * 60 * 1000);

  let temporalProximityScore = 0;
  if (daysUntil >= 0 && daysUntil <= 7) temporalProximityScore = 40 - daysUntil * 3;
  else if (daysUntil > 7 && daysUntil <= 30) temporalProximityScore = 20 - (daysUntil - 7) * 0.5;
  else if (daysUntil > 30 && daysUntil <= 90) temporalProximityScore = 8;
  else if (daysUntil < 0 && daysUntil > -1) temporalProximityScore = 15;
  temporalProximityScore = clamp(temporalProximityScore, 0, 40);

  let geographicCompletenessScore = 0;
  if (input.locationConfirmedAt) geographicCompletenessScore += 12;

  let completenessScore = 0;
  if (input.coverImageUrl) completenessScore += 8;
  if (input.categoryId) completenessScore += 5;
  if ((input.description || "").trim().length >= 40) completenessScore += 5;
  if (input.registrationUrl) completenessScore += 5;

  const recentViews = input.recentViews ?? 0;
  const recentViewsScore = clamp(Math.log10(recentViews + 1) * 8, 0, 20);

  const clicks = input.registrationClicks ?? 0;
  const registrationClickScore = clamp(Math.log10(clicks + 1) * 10, 0, 15);

  const photographerCallBonus = input.seekingPhotographers ? 12 : 0;

  const editorialPriorityScore = clamp((input.editorialPriority ?? 0) / 100 * 30, 0, 30);

  let freshnessScore = 0;
  if (input.publishedAt) {
    const daysSincePub =
      (now.getTime() - input.publishedAt.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSincePub <= 3) freshnessScore = 10;
    else if (daysSincePub <= 14) freshnessScore = 6;
    else if (daysSincePub <= 45) freshnessScore = 3;
  }

  const total =
    temporalProximityScore +
    geographicCompletenessScore +
    completenessScore +
    recentViewsScore +
    registrationClickScore +
    photographerCallBonus +
    editorialPriorityScore +
    freshnessScore;

  return {
    total,
    temporalProximityScore,
    geographicCompletenessScore,
    recentViewsScore,
    registrationClickScore,
    photographerCallBonus,
    editorialPriorityScore,
    freshnessScore,
    completenessScore,
  };
}
