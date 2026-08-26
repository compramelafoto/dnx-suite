import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createEmptyContentJson } from "@repo/content";
import type { ContentPostFormValue } from "../types";
import { buildContentPostSubmitPayload, toDatetimeLocal } from "./buildSubmitPayload";

function baseForm(overrides: Partial<ContentPostFormValue> = {}): ContentPostFormValue {
  return {
    title: "  Hola mundo  ",
    slug: "  hola-mundo  ",
    excerpt: "  resumen  ",
    contentJson: createEmptyContentJson(),
    heroImageUrl: "https://cdn.example.com/hero.jpg",
    status: "DRAFT",
    type: "BLOG",
    categoryId: "3",
    authorId: "",
    tagIds: [1, 2],
    seoTitle: " SEO ",
    seoDescription: "",
    seoGoal: "goal",
    ogImageUrl: "",
    canonicalUrl: "",
    noIndex: false,
    lastReviewedAt: "",
    isFeatured: true,
    featuredUntil: "",
    ...overrides,
  };
}

describe("buildContentPostSubmitPayload", () => {
  it("trims fields and syncs og from hero", () => {
    const payload = buildContentPostSubmitPayload(baseForm());
    assert.equal(payload.title, "Hola mundo");
    assert.equal(payload.slug, "hola-mundo");
    assert.equal(payload.excerpt, "resumen");
    assert.equal(payload.heroImageUrl, "https://cdn.example.com/hero.jpg");
    assert.equal(payload.ogImageUrl, "https://cdn.example.com/hero.jpg");
    assert.equal(payload.categoryId, 3);
    assert.equal(payload.authorId, null);
    assert.equal(payload.isFeatured, false);
  });

  it("allows featured only when publishing", () => {
    const payload = buildContentPostSubmitPayload(baseForm({ isFeatured: true }), "PUBLISHED");
    assert.equal(payload.status, "PUBLISHED");
    assert.equal(payload.isFeatured, true);
  });
});

describe("toDatetimeLocal", () => {
  it("formats a stable local datetime string", () => {
    const value = toDatetimeLocal(new Date(2026, 5, 1, 12, 30));
    assert.match(value, /^2026-06-01T12:30$/);
  });
});
