/**
 * Tests Etapa 15 — Home geointeligente + ranking editorial vía @repo/geo.
 * Ejecutar: pnpm --filter infospot test:etapa-15
 */

import assert from "node:assert/strict";
import { FEED_CONFIG } from "./config";
import { calculateInfoSpotFeedScore, compareFeedItems, geographicAffinityScore } from "./score";
import { infoSpotFeedItemToGeoFeedItem } from "./geo-bridge";
import { buildFeedMetrics } from "./metrics";
import {
  articleToFeedCandidate,
  type RawArticleForFeed,
} from "./normalize";
import { rankFeedCandidatesForTest } from "./query";
import type { InfoSpotFeedItem } from "./types";

const now = new Date("2026-07-22T15:00:00.000Z");
const rosario = { latitude: -32.944, longitude: -60.651 };

function baseArticle(
  overrides: Partial<RawArticleForFeed> & { id: string; title: string; slug: string },
): RawArticleForFeed {
  return {
    excerpt: null,
    publishedAt: new Date("2026-07-21T12:00:00.000Z"),
    updatedAt: new Date("2026-07-21T12:00:00.000Z"),
    editorialPriority: 0,
    clfAlbumId: null,
    status: "PUBLISHED",
    category: { name: "Cultura", slug: "cultura" },
    coverImage: null,
    coverageLinks: [],
    author: null,
    ...overrides,
  };
}

// Pesos configurables centralizados
{
  assert.equal(FEED_CONFIG.ranking.weights.distance, 0.4);
  assert.equal(FEED_CONFIG.ranking.weights.freshness, 0.25);
  assert.equal(FEED_CONFIG.ranking.weights.priority, 0.15);
  assert.equal(FEED_CONFIG.ranking.weights.popularity, 0.1);
  assert.equal(FEED_CONFIG.ranking.weights.category, 0.1);
}

// GPS: cercanía importa
{
  const near = calculateInfoSpotFeedScore({
    publishedAt: now,
    distanceKm: 4,
    isFeatured: false,
    editorialPriority: 10,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: rosario.latitude,
    originLongitude: rosario.longitude,
    itemLatitude: -32.95,
    itemLongitude: -60.66,
    geographicScope: "LOCAL",
  });
  const far = calculateInfoSpotFeedScore({
    publishedAt: now,
    distanceKm: 280,
    isFeatured: false,
    editorialPriority: 10,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: rosario.latitude,
    originLongitude: rosario.longitude,
    itemLatitude: -34.6,
    itemLongitude: -58.38,
    geographicScope: "LOCAL",
  });
  assert.ok(near.total > far.total);
  assert.ok(near.explain);
  assert.equal(near.excluded, false);
}

// Sin GPS (modo nacional): no excluye, score finito
{
  const national = calculateInfoSpotFeedScore({
    publishedAt: now,
    distanceKm: null,
    isFeatured: false,
    editorialPriority: 20,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    geographicScope: "NATIONAL",
  });
  assert.equal(national.excluded, false);
  assert.ok(Number.isFinite(national.total));
  assert.ok(national.total > 0);
}

// Usuario sin ubicación — ranking de candidatos
{
  const articles = [
    baseArticle({
      id: "n1",
      title: "Nacional",
      slug: "nacional",
      geographicScope: "NATIONAL",
      countryName: "Argentina",
    }),
    baseArticle({
      id: "l1",
      title: "Local sin origen",
      slug: "local",
      geographicScope: "LOCAL",
      city: "Rosario",
      province: "Santa Fe",
      latitude: -32.94,
      longitude: -60.65,
    }),
  ];
  const ranked = rankFeedCandidatesForTest(articles, [], null, now);
  assert.equal(ranked.length, 2);
  assert.ok(ranked.every((i) => i.distanceKm == null));
}

// Usuario GPS Rosario — local primero
{
  const origin = {
    latitude: rosario.latitude,
    longitude: rosario.longitude,
    mode: "gps" as const,
    province: "Santa Fe",
  };
  const articles = [
    baseArticle({
      id: "bsas",
      title: "Nota CABA",
      slug: "caba",
      geographicScope: "LOCAL",
      city: "Buenos Aires",
      province: "CABA",
      latitude: -34.6,
      longitude: -58.38,
      publishedAt: new Date("2026-07-22T12:00:00.000Z"),
    }),
    baseArticle({
      id: "ros",
      title: "Nota Rosario",
      slug: "rosario",
      geographicScope: "LOCAL",
      city: "Rosario",
      province: "Santa Fe",
      latitude: -32.95,
      longitude: -60.66,
      publishedAt: new Date("2026-07-22T11:00:00.000Z"),
    }),
    baseArticle({
      id: "nac",
      title: "Nota nacional",
      slug: "nac",
      geographicScope: "NATIONAL",
      countryName: "Argentina",
      publishedAt: new Date("2026-07-22T14:00:00.000Z"),
    }),
  ];
  const ranked = rankFeedCandidatesForTest(articles, [], origin, now);
  assert.equal(ranked[0]!.slug, "rosario");
}

// Afinidad provincial
{
  assert.ok(
    geographicAffinityScore({
      geographicScope: "PROVINCIAL",
      distanceKm: 80,
      hasOrigin: true,
      userProvince: "Santa Fe",
      itemProvince: "Santa Fe",
    }) >
      geographicAffinityScore({
        geographicScope: "PROVINCIAL",
        distanceKm: 80,
        hasOrigin: true,
        userProvince: "Santa Fe",
        itemProvince: "Córdoba",
      }),
  );
}

// Mezcla de tipos estable + desempate
{
  const a = {
    rankingScore: 50,
    publishedAt: now,
    distanceKm: 5 as number | null,
    editorialPriority: 1,
    updatedAt: now,
    id: "a",
  };
  const b = { ...a, id: "b" };
  assert.ok(compareFeedItems(a, b) < 0);
}

// Contenido sin ubicación no se excluye
{
  const item = articleToFeedCandidate(
    baseArticle({
      id: "no-geo",
      title: "Sin geo",
      slug: "sin-geo",
      geographicScope: "UNSPECIFIED",
    }),
    { latitude: rosario.latitude, longitude: rosario.longitude, mode: "gps" },
    now,
  );
  assert.ok(item);
  assert.equal(item!.distanceKm, null);
}

// Bridge GeoFeedItem
{
  const feedItem: InfoSpotFeedItem = {
    id: "article:1",
    contentKey: "article:1",
    type: "NEWS",
    typeLabel: "Noticia",
    title: "T",
    excerpt: null,
    slug: "t",
    publicUrl: "/noticias/t",
    imageUrl: null,
    publishedAt: now,
    updatedAt: null,
    startsAt: null,
    endsAt: null,
    latitude: -32.9,
    longitude: -60.6,
    city: "Rosario",
    province: "Santa Fe",
    country: "Argentina",
    isFeatured: false,
    editorialPriority: 10,
    isTimeSensitive: false,
    statusLabel: null,
    locationLabel: null,
    distanceKm: 3,
    distanceLabel: "A 3 km",
    rankingScore: 70,
    geographicScope: "LOCAL",
  };
  const geo = infoSpotFeedItemToGeoFeedItem(feedItem);
  assert.equal(geo.source, "INFOSPOT_ARTICLE");
  assert.equal(geo.cityName, "Rosario");
}

// Métricas
{
  const metrics = buildFeedMetrics({
    startedAt: Date.now() - 5,
    candidatesLoaded: 10,
    distanceCalculations: 4,
    ranked: [
      {
        id: "1",
        contentKey: "a:1",
        type: "NEWS",
        typeLabel: "Noticia",
        title: "t",
        excerpt: null,
        slug: "t",
        publicUrl: "/t",
        imageUrl: null,
        publishedAt: now,
        updatedAt: null,
        startsAt: null,
        endsAt: null,
        latitude: null,
        longitude: null,
        city: null,
        province: null,
        country: null,
        isFeatured: false,
        editorialPriority: 0,
        isTimeSensitive: false,
        statusLabel: null,
        locationLabel: null,
        distanceKm: 4,
        distanceLabel: null,
        rankingScore: 1,
        geographicScope: "LOCAL",
      },
    ],
    pageSize: 1,
    locationMode: "gps",
    personalized: true,
  });
  assert.equal(metrics.scopeCounts.local, 1);
  assert.ok(metrics.averageDistanceKm != null && metrics.averageDistanceKm > 0);
  assert.ok(metrics.durationMs >= 0);
}

// Empate de score → desempate por id
{
  const tied = [
    {
      rankingScore: 10,
      publishedAt: now,
      distanceKm: null as number | null,
      editorialPriority: 0,
      updatedAt: null,
      id: "z",
    },
    {
      rankingScore: 10,
      publishedAt: now,
      distanceKm: null as number | null,
      editorialPriority: 0,
      updatedAt: null,
      id: "a",
    },
  ];
  tied.sort(compareFeedItems);
  assert.equal(tied[0]!.id, "a");
}

console.log("etapa-15-home-geo.test.ts: ok");
