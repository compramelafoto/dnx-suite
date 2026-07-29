import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEditorialAssistantEngine,
  RuleBasedSuggestionProvider,
  suggestCategorySlug,
  suggestTags,
  EDITORIAL_THRESHOLDS,
} from "./index";
import type { EditorialDraftSnapshot } from "./types";

function draft(partial: Partial<EditorialDraftSnapshot> = {}): EditorialDraftSnapshot {
  return {
    title: "",
    excerpt: "",
    content: "",
    slug: "",
    seoTitle: "",
    seoDescription: "",
    categoryId: null,
    categorySlug: null,
    categoryName: null,
    availableCategories: [
      { id: "c1", name: "Deportes", slug: "deportes" },
      { id: "c2", name: "Cultura", slug: "cultura" },
      { id: "c3", name: "Fotografía", slug: "fotografia" },
      { id: "c4", name: "Eventos", slug: "eventos" },
    ],
    geographicScope: null,
    countryName: "Argentina",
    countryCode: "AR",
    province: null,
    city: null,
    placeName: null,
    latitude: null,
    longitude: null,
    hasCover: false,
    hasAuthor: true,
    hasSource: false,
    publishedAt: null,
    ...partial,
  };
}

describe("category rules", () => {
  it("sugiere deportes por keywords", () => {
    const slug = suggestCategorySlug(
      draft({
        title: "Gran partido de fútbol en Rosario",
        content: "El torneo local terminó con un gol.",
      }),
    );
    assert.equal(slug, "deportes");
  });

  it("sugiere cultura", () => {
    assert.equal(
      suggestCategorySlug(
        draft({ title: "Festival de música y teatro en la plaza" }),
      ),
      "cultura",
    );
  });
});

describe("tags", () => {
  it("incluye ciudad y provincia", () => {
    const tags = suggestTags(
      draft({
        title: "Accidente en Circunvalación",
        city: "Rosario",
        province: "Santa Fe",
        categoryName: "Policiales",
      }),
    );
    assert.ok(tags.includes("Rosario"));
    assert.ok(tags.includes("Santa Fe"));
  });
});

describe("engine analyze", () => {
  it("marca incompleta sin contenido", () => {
    const engine = createEditorialAssistantEngine();
    const result = engine.analyzeSync(draft({ title: "Hola" }));
    assert.equal(result.qualityLevel, "incomplete");
    assert.ok(result.completenessPercent < EDITORIAL_THRESHOLDS.completeness.fair);
  });

  it("SEO meta vacía", () => {
    const provider = new RuleBasedSuggestionProvider();
    const result = provider.analyze(
      draft({
        title: "Una noticia con título suficientemente largo",
        content: "x".repeat(200),
        slug: "una-noticia-con-titulo",
        categoryId: "c1",
        geographicScope: "NATIONAL",
        countryName: "Argentina",
      }),
    );
    assert.ok(result.suggestions.some((s) => s.id === "seo-meta-empty"));
  });

  it("geo local advierte faltantes", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({ geographicScope: "LOCAL", title: "Nota local de prueba" }),
    );
    assert.ok(result.suggestions.some((s) => s.id === "geo-missing-city"));
    assert.ok(result.suggestions.some((s) => s.id === "geo-missing-lat"));
  });

  it("no cambia categoría automáticamente — solo sugiere", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({
        title: "Gran partido de fútbol",
        content: "gol torneo liga",
        categoryId: "c2",
        categorySlug: "cultura",
        categoryName: "Cultura",
      }),
    );
    const cat = result.suggestions.find((s) => s.kind === "category");
    assert.ok(cat);
    assert.equal(cat!.action?.type, "applyCategory");
    assert.notEqual((cat!.action?.payload as { categoryId: string }).categoryId, "c2");
  });

  it("sugiere convocatoria ante evento futuro", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({
        title: "Festival de verano",
        content: "Habrá escenario y feria",
        linkedEventStartsAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        linkedEventTitle: "Festival",
        hasPhotographerCall: false,
      }),
    );
    assert.ok(result.suggestions.some((s) => s.kind === "call"));
  });

  it("banner con prioridad alta", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({
        title: "Anuncio nacional importante de la semana",
        content: "y".repeat(450),
        geographicScope: "NATIONAL",
        hasCover: true,
        editorialPriority: 80,
      }),
    );
    assert.ok(result.suggestions.some((s) => s.kind === "banner"));
  });

  it("checklist y score", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({
        title: "Cobertura completa del festival local de Rosario",
        excerpt: "Una bajada con suficiente longitud para el checklist editorial.",
        content: "z".repeat(500),
        slug: "cobertura-festival-rosario",
        categoryId: "c2",
        categoryName: "Cultura",
        geographicScope: "LOCAL",
        city: "Rosario",
        province: "Santa Fe",
        latitude: -32.9,
        longitude: -60.6,
        hasCover: true,
        hasSource: true,
        seoDescription: "Meta description suficientemente larga para SEO de la nota editorial.",
      }),
    );
    assert.ok(result.completenessPercent >= 70);
    assert.ok(result.checklist.some((c) => c.id === "title" && c.ok));
    assert.ok(result.suggestions.some((s) => s.kind === "summary"));
  });

  it("duplicados vía relatedHits", () => {
    const result = new RuleBasedSuggestionProvider().analyze(
      draft({
        title: "Incendio en el centro de Rosario",
        relatedHits: [
          {
            id: "1",
            title: "Incendio en el centro de Rosario ayer",
            url: "/noticias/x",
            kind: "article",
          },
        ],
      }),
    );
    assert.ok(result.suggestions.some((s) => s.kind === "duplicate"));
  });
});
