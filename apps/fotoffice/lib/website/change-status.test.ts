import { describe, expect, it } from "vitest";
import { computeWebsiteChangeStatus } from "./change-status";

const base = {
  heroTitle: "T",
  heroSubtitle: null,
  seoTitle: null,
  seoDescription: null,
  navJson: { items: [{ id: "home" }] },
  sectionsJson: { pages: { home: [{ id: "1", type: "SPACER", visible: true, order: 0, config: { sizePreset: "md" } }] } },
};

describe("computeWebsiteChangeStatus", () => {
  it("nunca publicado (sin versión, sin historial)", () => {
    expect(computeWebsiteChangeStatus({ draft: base, publishedVersion: null, hasAnyVersionHistory: false })).toBe(
      "NEVER_PUBLISHED",
    );
  });

  it("despublicado (sin versión activa, pero con historial previo)", () => {
    expect(computeWebsiteChangeStatus({ draft: base, publishedVersion: null, hasAnyVersionHistory: true })).toBe(
      "UNPUBLISHED",
    );
  });

  it("publicado sin cambios: contenido idéntico al draft", () => {
    expect(computeWebsiteChangeStatus({ draft: base, publishedVersion: { ...base }, hasAnyVersionHistory: true })).toBe(
      "PUBLISHED_NO_CHANGES",
    );
  });

  it("publicado sin cambios ignora el orden de claves dentro del JSON (no es un false positive)", () => {
    const reordered = {
      ...base,
      sectionsJson: {
        pages: {
          home: [{ order: 0, config: { sizePreset: "md" }, visible: true, type: "SPACER", id: "1" }],
        },
      },
    };
    expect(computeWebsiteChangeStatus({ draft: base, publishedVersion: reordered, hasAnyVersionHistory: true })).toBe(
      "PUBLISHED_NO_CHANGES",
    );
  });

  it("publicado con cambios: heroTitle distinto", () => {
    const changedDraft = { ...base, heroTitle: "Nuevo título" };
    expect(
      computeWebsiteChangeStatus({ draft: changedDraft, publishedVersion: { ...base }, hasAnyVersionHistory: true }),
    ).toBe("PUBLISHED_WITH_CHANGES");
  });

  it("publicado con cambios: sectionsJson distinto (un bloque agregado)", () => {
    const changedDraft = {
      ...base,
      sectionsJson: {
        pages: {
          home: [
            ...base.sectionsJson.pages.home,
            { id: "2", type: "SPACER", visible: true, order: 1, config: { sizePreset: "sm" } },
          ],
        },
      },
    };
    expect(
      computeWebsiteChangeStatus({ draft: changedDraft, publishedVersion: { ...base }, hasAnyVersionHistory: true }),
    ).toBe("PUBLISHED_WITH_CHANGES");
  });
});
