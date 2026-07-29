/**
 * Tests de integración del feed.
 * Ejecutar: pnpm --filter infospot test:feed:integration
 *
 * Offline (siempre): ranking, cursor, validación.
 * Prisma (obligatorio si FEED_INTEGRATION_REQUIRE_DB=1): getPublicFeed real.
 * Sin ese flag: si DB falla, el test FALLA en modo estricto solo cuando se pide;
 * por defecto intenta Prisma y marca BLOQUEADO (exit 1) si no hay datos/DB.
 */

import assert from "node:assert/strict";
import { parseFeedSearchParams } from "./validate";
import { encodeFeedCursor, decodeFeedCursor } from "./cursor";
import { toFeedItemDto } from "./normalize";
import { rankFeedCandidatesForTest } from "./query";
import type { RawArticleForFeed, RawEventForFeed } from "./normalize";
import { calculateDistanceKm } from "./distance";

const now = new Date("2026-07-22T15:00:00.000Z");

// Feed general sin parámetros
{
  const parsed = parseFeedSearchParams(new URLSearchParams());
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.locationMode, "none");
    assert.equal(parsed.data.lat, null);
    assert.equal(parsed.data.lng, null);
  }
}

// Feed con ubicación
{
  const parsed = parseFeedSearchParams(
    new URLSearchParams("lat=-32.9468&lng=-60.6393&locationMode=gps&limit=12"),
  );
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.locationMode, "gps");
    assert.ok(parsed.data.lat != null);
  }
}

// Paginación estable + sin duplicados
{
  const articles: RawArticleForFeed[] = Array.from({ length: 8 }, (_, i) => ({
    id: `a${i}`,
    title: `Nota ${i}`,
    slug: `nota-${i}`,
    excerpt: null,
    publishedAt: new Date(now.getTime() - i * 3600_000),
    updatedAt: now,
    editorialPriority: 0,
    clfAlbumId: null,
    status: "PUBLISHED",
    category: { name: "Cultura", slug: "cultura" },
    coverImage: null,
    coverageLinks: [],
    author: {
      city: "Rosario",
      province: "Santa Fe",
      country: "Argentina",
      latitude: -32.94,
      longitude: -60.65,
    },
  }));

  const events: RawEventForFeed[] = [
    {
      id: "e1",
      title: "Evento Rosario",
      slug: "evento-rosario",
      summary: "Cerca",
      startAt: new Date("2026-07-28T18:00:00.000Z"),
      endAt: null,
      city: "Rosario",
      province: "Santa Fe",
      countryName: "Argentina",
      latitude: -32.95,
      longitude: -60.64,
      coverImageUrl: null,
      publishedAt: new Date("2026-07-20T12:00:00.000Z"),
      updatedAt: now,
      editorialPriority: 0,
      registrationUrl: null,
      status: "PUBLISHED",
      category: null,
      photographerCall: null,
      contentOrigins: [],
    },
    {
      id: "e-finished",
      title: "Evento viejo",
      slug: "evento-viejo",
      summary: null,
      startAt: new Date("2026-06-01T12:00:00.000Z"),
      endAt: new Date("2026-06-01T18:00:00.000Z"),
      city: "Rosario",
      province: "Santa Fe",
      countryName: "Argentina",
      latitude: -32.94,
      longitude: -60.65,
      coverImageUrl: null,
      publishedAt: new Date("2026-05-20T12:00:00.000Z"),
      updatedAt: now,
      editorialPriority: 80,
      registrationUrl: null,
      status: "PUBLISHED",
      category: null,
      photographerCall: null,
      contentOrigins: [],
    },
  ];

  const origin = {
    latitude: -32.9468,
    longitude: -60.6393,
    mode: "gps" as const,
  };

  const ranked = rankFeedCandidatesForTest(articles, events, origin, now);
  assert.ok(ranked.length >= 5);
  assert.ok(!ranked.some((i) => i.slug === "evento-viejo"));

  const keys = ranked.map((i) => i.contentKey);
  assert.equal(new Set(keys).size, keys.length, "sin duplicados");

  const withDistance = ranked.filter((i) => i.distanceKm != null);
  assert.ok(withDistance.length > 0);
  for (const item of withDistance) {
    if (item.latitude == null || item.longitude == null) continue;
    const expected = calculateDistanceKm(
      origin.latitude,
      origin.longitude,
      item.latitude,
      item.longitude,
    );
    assert.ok(Math.abs((item.distanceKm ?? 0) - expected) < 0.05);
  }

  // Cursor page 1 → page 2
  const page1 = ranked.slice(0, 3);
  const last = page1[page1.length - 1]!;
  const cursor = encodeFeedCursor({
    v: 1,
    score: last.rankingScore,
    publishedAt: last.publishedAt.toISOString(),
    id: last.id,
  });
  assert.ok(decodeFeedCursor(cursor));

  const dto = toFeedItemDto(last);
  assert.equal(typeof dto.publishedAt, "string");
  assert.ok(!("authorEmail" in dto));
}

// Prisma: getPublicFeed real (no se reporta OK si se omite)
{
  const requireDb = process.env.FEED_INTEGRATION_REQUIRE_DB === "1";
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (requireDb) {
      throw new Error("FEED_INTEGRATION_REQUIRE_DB=1 pero DATABASE_URL ausente");
    }
    console.error("feed integration: BLOQUEADO — DATABASE_URL ausente");
    process.exitCode = 1;
  } else {
    try {
      const { getPublicFeed } = await import("./query");
      const general = await getPublicFeed({ limit: 12, locationMode: "none" });
      assert.ok(Array.isArray(general.items));
      assert.ok(
        general.items.length > 0,
        "Se esperaba al menos 1 ítem PUBLISHED (correr qa:11b:seed)",
      );
      assert.ok(general.items.every((i) => i.publicUrl.startsWith("/")));
      for (const item of general.items) {
        assert.equal(item.id.includes("DRAFT"), false);
        assert.notEqual(item.typeLabel, "");
      }
      const keys = general.items.map((i) => i.contentKey);
      assert.equal(new Set(keys).size, keys.length);

      const page2 = await getPublicFeed({
        limit: 5,
        cursor: general.nextCursor,
        locationMode: "none",
      });
      if (general.hasMore) {
        const overlap = page2.items.filter((i) => keys.includes(i.contentKey));
        assert.equal(overlap.length, 0, "paginación no debe duplicar");
      }

      const personalized = await getPublicFeed({
        limit: 12,
        lat: -32.9468,
        lng: -60.6393,
        locationMode: "gps",
      });
      assert.equal(personalized.personalized, true);
      assert.equal(personalized.locationMode, "gps");

      const again = await getPublicFeed({ limit: 12, locationMode: "none" });
      assert.deepEqual(
        again.items.map((i) => i.contentKey),
        general.items.map((i) => i.contentKey),
        "orden estable sin ubicación",
      );

      console.log(
        JSON.stringify({
          prismaIntegration: "executed",
          generalCount: general.items.length,
          types: [...new Set(general.items.map((i) => i.type))],
          personalizedCount: personalized.items.length,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Can't reach database|P1001|PrismaClientInitializationError/i.test(message)) {
        console.error("feed integration: BLOQUEADO — DB no alcanzable");
        console.error(message.slice(0, 200));
        process.exitCode = 1;
      } else {
        throw err;
      }
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  console.error("feed integration tests: BLOQUEADO/FAIL");
} else {
  console.log("feed integration tests: ok");
}