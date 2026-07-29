/**
 * Tests Etapa 16 — adaptador InfoSpot del Asistente Editorial.
 */

import assert from "node:assert/strict";
import { createEditorialAssistantEngine } from "@repo/editorial-intelligence";
import { buildInfoSpotDraftSnapshot } from "./snapshot";

const engine = createEditorialAssistantEngine();

{
  const snap = buildInfoSpotDraftSnapshot({
    title: "Gran partido de fútbol en Rosario",
    excerpt: "El torneo local tuvo un final electrizante.",
    content: "El gol llegó en el minuto 90 del partido.",
    slug: "gran-partido-futbol-rosario",
    seoTitle: "",
    seoDescription: "",
    categoryId: "",
    categories: [
      { id: "1", name: "Deportes", slug: "deportes" },
      { id: "2", name: "Cultura", slug: "cultura" },
    ],
    geographicScope: "LOCAL",
    countryName: "Argentina",
    countryCode: "AR",
    province: "Santa Fe",
    city: "Rosario",
    placeName: null,
    latitude: -32.94,
    longitude: -60.65,
    hasCover: true,
    hasAuthor: true,
    hasSource: true,
    publishedAt: null,
  });

  const result = engine.analyzeSync(snap);
  assert.ok(result.suggestions.some((s) => s.kind === "category"));
  assert.ok(result.suggestions.some((s) => s.kind === "tag"));
  assert.ok(result.suggestions.some((s) => s.kind === "seo"));
  assert.ok(result.checklist.some((c) => c.id === "location" && c.ok));
  assert.equal(result.providerId, "rule-based");
}

{
  const snap = buildInfoSpotDraftSnapshot({
    title: "Nota",
    excerpt: "",
    content: "",
    slug: "nota",
    seoTitle: "",
    seoDescription: "",
    categoryId: "",
    categories: [],
    geographicScope: null,
    countryName: null,
    countryCode: null,
    province: null,
    city: null,
    placeName: null,
    latitude: null,
    longitude: null,
    hasCover: false,
    hasAuthor: false,
    hasSource: false,
    publishedAt: null,
  });
  const result = engine.analyzeSync(snap);
  assert.equal(result.qualityLevel, "incomplete");
  assert.ok(result.suggestions.some((s) => s.id === "geo-missing-scope"));
}

console.log("etapa-16-editorial-intelligence.test.ts: ok");
