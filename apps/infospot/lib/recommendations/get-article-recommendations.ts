/**
 * Carga candidatos InfoSpot y rankea con @repo/recommendations.
 * Prisma solo aquí — el motor permanece puro.
 */

import { prisma } from "@repo/db";
import {
  createRecommendationEngine,
  infoSpotArticleToRecommendationItem,
  infoSpotEventToRecommendationItem,
  type RankedRecommendation,
  type RecommendationItem,
} from "@repo/recommendations";
import { planNearbyQuery, boundingBoxWhere } from "@repo/geo/nearby";
import { publicPublishedArticleWhere, publicPublishedEventWhere } from "@/lib/distribution/public-rules";
import { resolvePhotographerCallFromSources } from "@/lib/distribution/photographer-call";
import { getEventTemporalState } from "@/lib/distribution/temporal";

const engine = createRecommendationEngine();

export type ArticleRecommendationBlocks = {
  similar: RankedRecommendation[];
  nearby: RankedRecommendation[];
  upcoming: RankedRecommendation[];
  openCalls: RankedRecommendation[];
  coverages: RankedRecommendation[];
};

function toSeed(article: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  categoryId: string | null;
  category: { id: string; slug: string; name: string } | null;
  geographicScope: string | null;
  countryCode: string | null;
  countryName: string | null;
  province: string | null;
  city: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  geohash: string | null;
  editorialPriority: number;
  clfAlbumId: number | null;
  coverImage: { url: string; thumbnailUrl: string | null } | null;
  coverageLinks: { id: string }[];
}): RecommendationItem {
  return infoSpotArticleToRecommendationItem(article);
}

async function loadCandidates(seed: RecommendationItem, now: Date) {
  const lookback = new Date(now.getTime() - 90 * 86_400_000);
  const articles = await prisma.infoSpotArticle.findMany({
    where: {
      ...publicPublishedArticleWhere(),
      id: { not: seed.sourceEntityId },
      publishedAt: { lte: now, gte: lookback },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      categoryId: true,
      geographicScope: true,
      countryCode: true,
      countryName: true,
      province: true,
      city: true,
      placeName: true,
      latitude: true,
      longitude: true,
      geohash: true,
      editorialPriority: true,
      clfAlbumId: true,
      category: { select: { id: true, slug: true, name: true } },
      coverImage: { select: { url: true, thumbnailUrl: true } },
      coverageLinks: { select: { id: true }, take: 1 },
    },
    orderBy: { publishedAt: "desc" },
    take: 60,
  });

  let nearbyArticles = articles;
  if (
    typeof seed.latitude === "number" &&
    typeof seed.longitude === "number"
  ) {
    const plan = planNearbyQuery(
      { latitude: seed.latitude, longitude: seed.longitude },
      80,
    );
    const box = boundingBoxWhere(plan.boundingBox);
    nearbyArticles = await prisma.infoSpotArticle.findMany({
      where: {
        ...publicPublishedArticleWhere(),
        id: { not: seed.sourceEntityId },
        publishedAt: { lte: now, gte: lookback },
        OR: [
          { ...box },
          ...(seed.categoryId ? [{ categoryId: seed.categoryId }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        categoryId: true,
        geographicScope: true,
        countryCode: true,
        countryName: true,
        province: true,
        city: true,
        placeName: true,
        latitude: true,
        longitude: true,
        geohash: true,
        editorialPriority: true,
        clfAlbumId: true,
        category: { select: { id: true, slug: true, name: true } },
        coverImage: { select: { url: true, thumbnailUrl: true } },
        coverageLinks: { select: { id: true }, take: 1 },
      },
      take: 40,
    });
  }

  const articleMap = new Map<string, (typeof articles)[0]>();
  for (const a of articles) articleMap.set(a.id, a);
  for (const a of nearbyArticles) articleMap.set(a.id, a);

  const events = await prisma.infoSpotEvent.findMany({
    where: {
      ...publicPublishedEventWhere(),
      OR: [
        { endAt: { gte: now } },
        { endAt: null, startAt: { gte: new Date(now.getTime() - 12 * 3_600_000) } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      summary: true,
      startAt: true,
      endAt: true,
      publishedAt: true,
      city: true,
      province: true,
      countryName: true,
      latitude: true,
      longitude: true,
      geohash: true,
      editorialPriority: true,
      coverImageUrl: true,
      registrationUrl: true,
      category: { select: { id: true, slug: true } },
      photographerCall: {
        select: {
          enabled: true,
          provisioningStatus: true,
          publicUrl: true,
          clfEventId: true,
          visibility: true,
          joinPolicy: true,
          maxPhotographers: true,
          desiredClfStatus: true,
        },
      },
      contentOrigins: {
        where: { sourceType: "COMPRAMELAFOTO", externalEntityType: "EVENT" },
        take: 1,
        select: {
          externalUrl: true,
          externalId: true,
          operationalPayload: true,
        },
      },
    },
    orderBy: { startAt: "asc" },
    take: 50,
  });

  const articleItems = [...articleMap.values()].map((a) =>
    infoSpotArticleToRecommendationItem(a),
  );

  const eventItems = events.map((e) => {
    const call = resolvePhotographerCallFromSources({
      registrationUrl: e.registrationUrl,
      photographerCall: e.photographerCall,
      origin: e.contentOrigins[0] ?? null,
    });
    const temporal = getEventTemporalState({
      startAt: e.startAt,
      endAt: e.endAt,
      now,
    });
    return infoSpotEventToRecommendationItem({
      ...e,
      isOpenPhotographerCall: call.eligible,
      isFinished: temporal === "FINISHED" || temporal === "CANCELLED",
    });
  });

  return [...articleItems, ...eventItems];
}

/**
 * Bloques de recomendación para detalle de nota.
 */
export async function getArticleRecommendationBlocks(article: {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  categoryId: string | null;
  category: { id: string; slug: string; name: string } | null;
  geographicScope: string | null;
  countryCode: string | null;
  countryName: string | null;
  province: string | null;
  city: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  geohash: string | null;
  editorialPriority: number;
  clfAlbumId: number | null;
  coverImage: { url: string; thumbnailUrl: string | null } | null;
  coverageLinks?: { id: string }[];
}): Promise<ArticleRecommendationBlocks> {
  const now = new Date();
  const seed = toSeed({
    ...article,
    coverageLinks: article.coverageLinks ?? [],
  });
  const candidates = await loadCandidates(seed, now);
  const baseCtx = {
    seed,
    excludeIds: [seed.id],
    now,
    userLatitude: seed.latitude,
    userLongitude: seed.longitude,
  };

  return {
    similar: engine.recommend(candidates, {
      ...baseCtx,
      block: "similar",
      limit: 6,
    }),
    nearby: engine.recommend(candidates, {
      ...baseCtx,
      block: "nearby",
      radiusKm: 80,
      limit: 6,
    }),
    upcoming: engine.recommend(candidates, {
      ...baseCtx,
      block: "upcoming_events",
      limit: 6,
    }),
    openCalls: engine.recommend(candidates, {
      ...baseCtx,
      block: "open_calls",
      limit: 6,
    }),
    coverages: engine.recommend(candidates, {
      ...baseCtx,
      block: "coverages",
      limit: 6,
    }),
  };
}
