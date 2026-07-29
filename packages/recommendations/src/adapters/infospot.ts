import type { RecommendationItem } from "../types";

/** Shape mínimo artículo InfoSpot. */
export type InfoSpotArticleRecSource = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: Date | string | null;
  categoryId?: string | null;
  category?: { id?: string; slug?: string; name?: string } | null;
  geographicScope?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  province?: string | null;
  city?: string | null;
  placeName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  editorialPriority?: number | null;
  clfAlbumId?: number | null;
  coverImage?: { url?: string | null; thumbnailUrl?: string | null } | null;
  coverageLinks?: { id: string }[];
  tags?: string[];
};

export type InfoSpotEventRecSource = {
  id: string;
  title: string;
  slug: string;
  summary?: string | null;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  publishedAt?: Date | string | null;
  city?: string | null;
  province?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geohash?: string | null;
  editorialPriority?: number | null;
  coverImageUrl?: string | null;
  category?: { id?: string; slug?: string } | null;
  isOpenPhotographerCall?: boolean;
  isFinished?: boolean;
};

function isCoverage(article: InfoSpotArticleRecSource): boolean {
  return (
    (article.coverageLinks?.length ?? 0) > 0 ||
    article.clfAlbumId != null ||
    (article.category?.slug ?? "").includes("cobertura")
  );
}

export function infoSpotArticleToRecommendationItem(
  article: InfoSpotArticleRecSource,
): RecommendationItem {
  return {
    id: `infospot:article:${article.id}`,
    source: "INFOSPOT",
    sourceEntityId: article.id,
    contentType: isCoverage(article) ? "COVERAGE" : "NEWS",
    title: article.title,
    excerpt: article.excerpt,
    publicUrl: `/noticias/${article.slug}`,
    imageUrl:
      article.coverImage?.thumbnailUrl || article.coverImage?.url || null,
    categoryId: article.categoryId ?? article.category?.id ?? null,
    categorySlug: article.category?.slug ?? null,
    tags: article.tags,
    publishedAt: article.publishedAt,
    geographicScope: article.geographicScope,
    countryCode: article.countryCode,
    countryName: article.countryName,
    provinceName: article.province,
    cityName: article.city,
    placeName: article.placeName,
    latitude: article.latitude,
    longitude: article.longitude,
    geohash: article.geohash,
    priority: article.editorialPriority ?? 0,
  };
}

export function infoSpotEventToRecommendationItem(
  event: InfoSpotEventRecSource,
): RecommendationItem {
  return {
    id: `infospot:event:${event.id}`,
    source: "INFOSPOT",
    sourceEntityId: event.id,
    contentType: event.isOpenPhotographerCall
      ? "PHOTOGRAPHER_CALL"
      : "EVENT",
    title: event.title,
    excerpt: event.summary,
    publicUrl: `/eventos/${event.slug}`,
    imageUrl: event.coverImageUrl,
    categoryId: event.category?.id ?? null,
    categorySlug: event.category?.slug ?? null,
    publishedAt: event.publishedAt,
    startsAt: event.startAt,
    endsAt: event.endAt,
    cityName: event.city,
    provinceName: event.province,
    countryName: event.countryName,
    latitude: event.latitude,
    longitude: event.longitude,
    geohash: event.geohash,
    priority: event.editorialPriority ?? 0,
    isOpenCall: event.isOpenPhotographerCall === true,
    isFinished: event.isFinished === true,
  };
}
