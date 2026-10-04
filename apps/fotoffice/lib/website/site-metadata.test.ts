import { describe, expect, it } from "vitest";
import { buildSiteMetadata, type SiteMetadataInput } from "./site-metadata";

const base: SiteMetadataInput = {
  commercialName: "SFPR",
  seoTitle: null,
  seoDescription: null,
  shortDescription: "Sociedad de Fotógrafos Profesionales de Rosario.",
  logoUrl: "https://cdn.test/logo.png",
  coverImageUrl: "https://cdn.test/portada.png",
  faviconUrl: null,
};

describe("buildSiteMetadata", () => {
  it("usa el nombre, la descripción breve y el logo", () => {
    const m = buildSiteMetadata(base);
    expect(m.title).toBe("SFPR");
    expect(m.description).toBe("Sociedad de Fotógrafos Profesionales de Rosario.");
    expect(m.openGraph).toMatchObject({
      siteName: "SFPR",
      images: [{ url: "https://cdn.test/logo.png", alt: "SFPR" }],
    });
    expect(m.icons).toEqual({ icon: "https://cdn.test/logo.png" });
  });

  it("lo cargado en Sitio web → SEO tiene prioridad", () => {
    const m = buildSiteMetadata({ ...base, seoTitle: "SFPR · Fotógrafos de Rosario", seoDescription: "  Otra   descripción " });
    expect(m.title).toBe("SFPR · Fotógrafos de Rosario");
    expect(m.description).toBe("Otra descripción");
  });

  it("sin logo usa la portada, y sin nada no inventa imagen ni descripción", () => {
    expect(buildSiteMetadata({ ...base, logoUrl: null }).openGraph).toMatchObject({ images: [{ url: "https://cdn.test/portada.png" }] });
    const m = buildSiteMetadata({ ...base, logoUrl: null, coverImageUrl: null, shortDescription: "  " });
    expect(m.description).toBeUndefined();
    expect(m.openGraph).not.toHaveProperty("images");
    expect(m.icons).toBeUndefined();
  });
});
