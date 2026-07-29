/**
 * Tests unitarios del feed unificado (ETAPA 11).
 * Ejecutar: pnpm --filter infospot test:feed
 */

import assert from "node:assert/strict";
import { calculateDistanceKm, formatDistanceLabel } from "./distance";
import { calculateInfoSpotFeedScore, compareFeedItems } from "./score";
import { diversifyFeedTypes, countConsecutiveTypes } from "./diversity";
import { classifyArticleFeedType, classifyEventFeedType } from "./classify";
import { decodeFeedCursor, encodeFeedCursor, isAfterFeedCursor } from "./cursor";
import { parseFeedSearchParams } from "./validate";
import {
  articleToFeedCandidate,
  eventToFeedCandidate,
  type RawArticleForFeed,
  type RawEventForFeed,
} from "./normalize";
import { rankFeedCandidatesForTest } from "./query";
import {
  roundCoordinate,
  sanitizePreferenceForStorage,
} from "./location-preference";
import { isPubliclyDistributable } from "../distribution/public-rules";

const now = new Date("2026-07-22T15:00:00.000Z");

// 1. Haversine Rosario ↔ Córdoba ~400 km
{
  const km = calculateDistanceKm(-32.9442, -60.6505, -31.4201, -64.1888);
  assert.ok(km > 350 && km < 450, `distancia inesperada: ${km}`);
  const nearLabel = formatDistanceLabel(2.35);
  assert.ok(nearLabel?.startsWith("A 2"));
  assert.ok(nearLabel?.endsWith("km"));
  assert.equal(formatDistanceLabel(18.2), "A 18 km");
}

// 2. Reciente + cercano gana a lejano
{
  const localRecent = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-22T10:00:00.000Z"),
    distanceKm: 5,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
  });
  const farRecent = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-22T10:00:00.000Z"),
    distanceKm: 400,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
  });
  assert.ok(localRecent.total > farRecent.total);
}

// 3. Entre dos ítems a misma distancia, gana el más fresco
{
  const nearFresh = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-22T12:00:00.000Z"),
    distanceKm: 5,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: -32.94,
    originLongitude: -60.65,
    itemLatitude: -32.95,
    itemLongitude: -60.66,
    geographicScope: "LOCAL",
  });
  const nearOld = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-06-01T12:00:00.000Z"),
    distanceKm: 5,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: -32.94,
    originLongitude: -60.65,
    itemLatitude: -32.95,
    itemLongitude: -60.66,
    geographicScope: "LOCAL",
  });
  assert.ok(
    nearFresh.total > nearOld.total,
    "a igual cercanía debe ganar la actualidad",
  );
}

// 3b. Local reciente gana a nacional reciente (Etapa 15)
{
  const local = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-22T10:00:00.000Z"),
    distanceKm: 8,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: -32.94,
    originLongitude: -60.65,
    itemLatitude: -32.95,
    itemLongitude: -60.66,
    geographicScope: "LOCAL",
  });
  const national = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-22T10:00:00.000Z"),
    distanceKm: null,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
    originLatitude: -32.94,
    originLongitude: -60.65,
    geographicScope: "NATIONAL",
  });
  assert.ok(
    local.total > national.total,
    "local reciente debe priorizarse sobre nacional reciente",
  );
}

// 4. Sin coordenadas no se excluye
{
  const noGeo = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-21T12:00:00.000Z"),
    distanceKm: null,
    isFeatured: false,
    editorialPriority: 10,
    startsAt: null,
    endsAt: null,
    itemType: "NEWS",
    now,
  });
  assert.equal(noGeo.excluded, false);
  assert.ok(noGeo.proximityScore > 0);
}

// 5. Evento futuro aparece
{
  const upcoming = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-07-10T12:00:00.000Z"),
    distanceKm: 20,
    isFeatured: false,
    editorialPriority: 0,
    startsAt: new Date("2026-07-25T18:00:00.000Z"),
    endsAt: new Date("2026-07-25T22:00:00.000Z"),
    itemType: "EVENT",
    now,
  });
  assert.equal(upcoming.excluded, false);
  assert.ok(upcoming.total > 0);
}

// 6. Evento finalizado excluido
{
  const finished = calculateInfoSpotFeedScore({
    publishedAt: new Date("2026-06-01T12:00:00.000Z"),
    distanceKm: 2,
    isFeatured: true,
    editorialPriority: 90,
    startsAt: new Date("2026-06-10T12:00:00.000Z"),
    endsAt: new Date("2026-06-10T18:00:00.000Z"),
    itemType: "EVENT",
    now,
    isExpired: true,
  });
  assert.equal(finished.excluded, true);
}

// 7. Convocatoria cerrada / no elegible no entra vía normalize
{
  const closed: RawEventForFeed = {
    id: "e-closed",
    title: "Buscan fotógrafos",
    slug: "call-closed",
    summary: "Cerrada",
    startAt: new Date("2026-07-25T12:00:00.000Z"),
    endAt: null,
    city: "Rosario",
    province: "Santa Fe",
    countryName: "Argentina",
    latitude: -32.94,
    longitude: -60.65,
    coverImageUrl: null,
    publishedAt: new Date("2026-07-20T12:00:00.000Z"),
    updatedAt: new Date("2026-07-20T12:00:00.000Z"),
    editorialPriority: 0,
    registrationUrl: null,
    status: "PUBLISHED",
    category: null,
    photographerCall: {
      enabled: true,
      provisioningStatus: "CLOSED",
      publicUrl: null,
      clfEventId: 1,
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      maxPhotographers: 10,
      desiredClfStatus: "CLOSED",
    },
    contentOrigins: [],
  };
  // Sin eligible call → se clasifica como EVENT (no PHOTOGRAPHER_CALL forzada)
  const item = eventToFeedCandidate(closed, null, now);
  assert.ok(item);
  assert.equal(item!.type, "EVENT");
}

// 8. Desempate estable
{
  const a = {
    rankingScore: 10,
    publishedAt: new Date("2026-07-20T12:00:00.000Z"),
    distanceKm: 5 as number | null,
    editorialPriority: 1,
    updatedAt: new Date("2026-07-20T13:00:00.000Z"),
    id: "a",
  };
  const b = { ...a, id: "b" };
  assert.ok(compareFeedItems(a, b) < 0);
  assert.ok(compareFeedItems(b, a) > 0);
}

// 9. Diversificación de tipos
{
  const items = [
    { id: "1", type: "NEWS" as const, rankingScore: 100 },
    { id: "2", type: "NEWS" as const, rankingScore: 99 },
    { id: "3", type: "NEWS" as const, rankingScore: 98 },
    { id: "4", type: "NEWS" as const, rankingScore: 97 },
    { id: "5", type: "EVENT" as const, rankingScore: 96 },
  ];
  const diversified = diversifyFeedTypes(items, {
    maxConsecutive: 3,
    maxScoreDelta: 20,
  });
  const types = diversified.map((i) => i.type);
  assert.ok(countConsecutiveTypes(types) <= 3);
  assert.ok(types.includes("EVENT"));
}

// 10. Validación lat/lng
{
  const bad = parseFeedSearchParams(new URLSearchParams("lat=999&lng=1"));
  assert.equal(bad.ok, false);
  const half = parseFeedSearchParams(new URLSearchParams("lat=-32.9"));
  assert.equal(half.ok, false);
  const ok = parseFeedSearchParams(
    new URLSearchParams("lat=-32.9468&lng=-60.6393&limit=20"),
  );
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.data.limit, 20);
    assert.equal(ok.data.lat, -32.9468);
  }
}

// 11. Fallback sin GPS — ranking funciona
{
  const articles: RawArticleForFeed[] = [
    {
      id: "a1",
      title: "Nota nacional",
      slug: "nota-nacional",
      excerpt: "Sin geo",
      publishedAt: new Date("2026-07-21T12:00:00.000Z"),
      updatedAt: new Date("2026-07-21T12:00:00.000Z"),
      editorialPriority: 0,
      clfAlbumId: null,
      status: "PUBLISHED",
      category: { name: "Cultura", slug: "cultura" },
      coverImage: null,
      coverageLinks: [],
      author: null,
    },
  ];
  const ranked = rankFeedCandidatesForTest(articles, [], null, now);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]!.distanceKm, null);
}

// 12. Borradores / privados excluidos
{
  assert.equal(isPubliclyDistributable({ status: "DRAFT" }), false);
  assert.equal(isPubliclyDistributable({ status: "PUBLISHED" }), true);
  const draft: RawArticleForFeed = {
    id: "draft",
    title: "Borrador",
    slug: "borrador",
    excerpt: null,
    publishedAt: new Date("2026-07-21T12:00:00.000Z"),
    updatedAt: new Date("2026-07-21T12:00:00.000Z"),
    editorialPriority: 100,
    clfAlbumId: null,
    status: "DRAFT",
    category: null,
    coverImage: null,
  };
  assert.equal(articleToFeedCandidate(draft, null, now), null);

  const futurePub: RawArticleForFeed = {
    ...draft,
    id: "future",
    status: "PUBLISHED",
    publishedAt: new Date("2026-08-01T12:00:00.000Z"),
  };
  assert.equal(articleToFeedCandidate(futurePub, null, now), null);
}

// Clasificación
{
  assert.equal(
    classifyArticleFeedType({
      hasCoverageLink: true,
      title: "Cualquier",
    }),
    "COVERAGE",
  );
  assert.equal(
    classifyArticleFeedType({ title: "Entrevista a un autor" }),
    "INTERVIEW",
  );
  assert.equal(
    classifyEventFeedType({ seekingPhotographers: true }),
    "PHOTOGRAPHER_CALL",
  );
}

// Cursor estable
{
  const encoded = encodeFeedCursor({
    v: 1,
    score: 80,
    publishedAt: now.toISOString(),
    id: "article:1",
  });
  const decoded = decodeFeedCursor(encoded);
  assert.ok(decoded);
  assert.equal(decoded!.id, "article:1");
  assert.equal(
    isAfterFeedCursor(
      {
        rankingScore: 70,
        publishedAt: now,
        id: "article:2",
      },
      decoded!,
    ),
    true,
  );
}

// Privacidad: redondeo
{
  assert.equal(roundCoordinate(-32.94681234), -32.947);
  const safe = sanitizePreferenceForStorage({
    v: 1,
    mode: "gps",
    permissionState: "granted",
    latitude: -32.94681234,
    longitude: -60.63931234,
    updatedAt: now.toISOString(),
  });
  assert.equal(safe.latitude, -32.947);
  assert.equal(safe.longitude, -60.639);
}

console.log("feed tests: ok");
