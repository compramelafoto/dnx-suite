/**
 * Tests Etapa 17 — wiring InfoSpot del Recommendation Engine (sin Prisma).
 */

import assert from "node:assert/strict";
import {
  createRecommendationEngine,
  infoSpotArticleToRecommendationItem,
} from "@repo/recommendations";

const engine = createRecommendationEngine();
const now = new Date("2026-07-23T12:00:00.000Z");

const seed = infoSpotArticleToRecommendationItem({
  id: "seed",
  title: "Seed Rosario",
  slug: "seed",
  categoryId: "c1",
  category: { id: "c1", slug: "deportes", name: "Deportes" },
  city: "Rosario",
  province: "Santa Fe",
  latitude: -32.94,
  longitude: -60.65,
  publishedAt: now,
  editorialPriority: 20,
});

const other = infoSpotArticleToRecommendationItem({
  id: "other",
  title: "Otra",
  slug: "otra",
  categoryId: "c1",
  category: { id: "c1", slug: "deportes", name: "Deportes" },
  city: "Rosario",
  latitude: -32.95,
  longitude: -60.66,
  publishedAt: now,
});

{
  const ranked = engine.recommend([seed, other], {
    seed,
    block: "similar",
    now,
  });
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0]!.item.sourceEntityId, "other");
  assert.ok(!ranked.some((r) => r.item.id === seed.id));
}

console.log("etapa-17-recommendations.test.ts: ok");
