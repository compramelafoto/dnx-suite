import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createRecommendationEngine,
  infoSpotArticleToRecommendationItem,
  infoSpotEventToRecommendationItem,
  clfEventToRecommendationItem,
  clickatonVenueToRecommendationItem,
  fotorankContestToRecommendationItem,
  fotofficeStudioToRecommendationItem,
  scoreRecommendationCandidate,
  RECOMMENDATION_WEIGHTS,
  type RecommendationItem,
} from "./index";

const now = new Date("2026-07-23T15:00:00.000Z");

const seed: RecommendationItem = {
  id: "infospot:article:seed",
  source: "INFOSPOT",
  sourceEntityId: "seed",
  contentType: "NEWS",
  title: "Nota Rosario",
  categoryId: "cat-dep",
  categorySlug: "deportes",
  tags: ["Rosario", "fútbol"],
  cityName: "Rosario",
  provinceName: "Santa Fe",
  latitude: -32.944,
  longitude: -60.651,
  publishedAt: now,
  priority: 40,
};

describe("config", () => {
  it("pesos centralizados", () => {
    assert.ok(RECOMMENDATION_WEIGHTS.category > 0);
    assert.ok(RECOMMENDATION_WEIGHTS.geo > 0);
  });
});

describe("score", () => {
  it("misma categoría + cercanía gana a lejano otra categoría", () => {
    const near = scoreRecommendationCandidate(
      {
        id: "a",
        source: "INFOSPOT",
        sourceEntityId: "a",
        contentType: "NEWS",
        title: "Local",
        categoryId: "cat-dep",
        categorySlug: "deportes",
        latitude: -32.95,
        longitude: -60.66,
        cityName: "Rosario",
        publishedAt: now,
      },
      { seed, now },
    );
    const far = scoreRecommendationCandidate(
      {
        id: "b",
        source: "INFOSPOT",
        sourceEntityId: "b",
        contentType: "NEWS",
        title: "Lejos",
        categoryId: "cat-cul",
        categorySlug: "cultura",
        latitude: -34.6,
        longitude: -58.38,
        cityName: "Buenos Aires",
        publishedAt: now,
      },
      { seed, now },
    );
    assert.ok(near.score > far.score);
    assert.ok(near.explain.summaryLines.some((l) => /Categoría|Rosario|Distancia|Score/.test(l)));
  });

  it("excluye el contenido actual", () => {
    const self = scoreRecommendationCandidate(seed, { seed, now });
    assert.equal(self.excluded, true);
  });

  it("explicabilidad tiene factores", () => {
    const scored = scoreRecommendationCandidate(
      {
        id: "c",
        source: "INFOSPOT",
        sourceEntityId: "c",
        contentType: "NEWS",
        title: "X",
        categorySlug: "deportes",
        categoryId: "cat-dep",
        publishedAt: now,
      },
      { seed, now },
    );
    assert.ok(scored.explain.factors.length >= 5);
    assert.ok(scored.explain.finalScore === scored.score);
  });
});

describe("engine blocks", () => {
  const engine = createRecommendationEngine();
  const candidates: RecommendationItem[] = [
    seed,
    {
      id: "infospot:article:1",
      source: "INFOSPOT",
      sourceEntityId: "1",
      contentType: "NEWS",
      title: "Otra nota deportes Rosario",
      categoryId: "cat-dep",
      categorySlug: "deportes",
      latitude: -32.95,
      longitude: -60.66,
      cityName: "Rosario",
      publishedAt: new Date("2026-07-22T12:00:00.000Z"),
      publicUrl: "/noticias/1",
    },
    {
      id: "infospot:event:2",
      source: "INFOSPOT",
      sourceEntityId: "2",
      contentType: "EVENT",
      title: "Partido",
      startsAt: new Date("2026-07-30T18:00:00.000Z"),
      latitude: -32.94,
      longitude: -60.65,
      cityName: "Rosario",
      publicUrl: "/eventos/2",
    },
    {
      id: "infospot:event:3",
      source: "INFOSPOT",
      sourceEntityId: "3",
      contentType: "PHOTOGRAPHER_CALL",
      title: "Buscan fotógrafos",
      isOpenCall: true,
      startsAt: new Date("2026-08-01T12:00:00.000Z"),
      latitude: -32.94,
      longitude: -60.65,
      publicUrl: "/eventos/3",
    },
    {
      id: "infospot:article:4",
      source: "INFOSPOT",
      sourceEntityId: "4",
      contentType: "COVERAGE",
      title: "Cobertura",
      categorySlug: "fotografia",
      publishedAt: now,
      publicUrl: "/noticias/4",
    },
    {
      id: "infospot:event:closed",
      source: "INFOSPOT",
      sourceEntityId: "closed",
      contentType: "PHOTOGRAPHER_CALL",
      title: "Cerrada",
      isOpenCall: false,
      publicUrl: "/eventos/closed",
    },
  ];

  it("similar no incluye seed", () => {
    const ranked = engine.recommend(candidates, {
      seed,
      block: "similar",
      now,
      limit: 10,
    });
    assert.ok(ranked.every((r) => r.item.id !== seed.id));
    assert.ok(ranked.length >= 1);
  });

  it("nearby filtra por radio", () => {
    const ranked = engine.recommend(candidates, {
      seed,
      block: "nearby",
      radiusKm: 30,
      now,
    });
    assert.ok(ranked.every((r) => r.distanceKm != null && r.distanceKm <= 30));
  });

  it("open_calls solo abiertas", () => {
    const ranked = engine.recommend(candidates, {
      seed,
      block: "open_calls",
      now,
    });
    assert.ok(ranked.every((r) => r.item.isOpenCall === true));
    assert.equal(ranked.length, 1);
  });

  it("upcoming_events", () => {
    const ranked = engine.recommend(candidates, {
      seed,
      block: "upcoming_events",
      now,
    });
    assert.ok(ranked.every((r) => r.item.contentType === "EVENT" || r.item.contentType === "CONTEST"));
  });

  it("coverages", () => {
    const ranked = engine.recommend(candidates, {
      seed,
      block: "coverages",
      now,
    });
    assert.ok(ranked.every((r) => r.item.contentType === "COVERAGE" || r.item.contentType === "GALLERY"));
  });

  it("empate estable por id", () => {
    const a: RecommendationItem = {
      id: "z",
      source: "INFOSPOT",
      sourceEntityId: "z",
      contentType: "NEWS",
      title: "Z",
      publishedAt: now,
      priority: 0,
    };
    const b: RecommendationItem = {
      id: "a",
      source: "INFOSPOT",
      sourceEntityId: "a",
      contentType: "NEWS",
      title: "A",
      publishedAt: now,
      priority: 0,
    };
    const ranked = engine.recommend([a, b], { now, limit: 2 });
    assert.equal(ranked[0]?.item.id, "a");
  });
});

describe("adapters", () => {
  it("InfoSpot / CLF / stubs", () => {
    const art = infoSpotArticleToRecommendationItem({
      id: "1",
      title: "N",
      slug: "n",
      category: { slug: "deportes" },
      coverageLinks: [{ id: "x" }],
    });
    assert.equal(art.contentType, "COVERAGE");

    const ev = infoSpotEventToRecommendationItem({
      id: "2",
      title: "E",
      slug: "e",
      isOpenPhotographerCall: true,
    });
    assert.equal(ev.contentType, "PHOTOGRAPHER_CALL");

    assert.equal(
      clfEventToRecommendationItem({ id: 9, title: "CLF" }).source,
      "COMPRAMELAFOTO",
    );
    assert.equal(
      clickatonVenueToRecommendationItem({ id: 1, name: "Sede" }).source,
      "CLICKATON",
    );
    assert.equal(
      fotorankContestToRecommendationItem({ id: 1, title: "C" }).contentType,
      "CONTEST",
    );
    assert.equal(
      fotofficeStudioToRecommendationItem({ id: 1, name: "Estudio" }).source,
      "FOTOFFICE",
    );
  });
});
