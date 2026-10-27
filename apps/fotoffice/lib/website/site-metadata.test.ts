import { describe, expect, it } from "vitest";
import { buildCustomPageMetadata, buildSiteMetadata, type SiteMetadataInput } from "./site-metadata";

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

describe("buildSiteMetadata — Ajustes del sitio", () => {
  it("sin ajustes queda igual que antes (sin keywords ni verificación)", () => {
    const m = buildSiteMetadata(base);
    expect(m).not.toHaveProperty("keywords");
    expect(m).not.toHaveProperty("verification");
    expect(m.twitter).toMatchObject({ card: "summary" });
  });

  it("palabras clave, verificación de Google e imagen al compartir elegida", () => {
    const m = buildSiteMetadata({
      ...base,
      keywords: ["fotografía", "bodas"],
      googleVerification: "abcDEF_123-xyz",
      shareImageUrl: "https://cdn.test/compartir.jpg",
    });
    expect(m.keywords).toEqual(["fotografía", "bodas"]);
    expect(m.verification).toEqual({ google: "abcDEF_123-xyz" });
    expect(m.openGraph).toMatchObject({ images: [{ url: "https://cdn.test/compartir.jpg" }] });
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: ["https://cdn.test/compartir.jpg"] });
  });
});

describe("buildCustomPageMetadata", () => {
  it("una página común: título con el nombre y sin robots", () => {
    const m = buildCustomPageMetadata({ commercialName: "DNX", title: "Cursos", seoDescription: " Aprendé " });
    expect(m.title).toBe("Cursos · DNX");
    expect(m.description).toBe("Aprendé");
    expect(m).not.toHaveProperty("robots");
    expect(m).not.toHaveProperty("openGraph");
  });

  it("ocultar de buscadores → noindex; imagen propia → openGraph completo", () => {
    const m = buildCustomPageMetadata({
      commercialName: "DNX",
      title: "Cursos",
      seoTitle: "Cursos de fotografía",
      hideFromSearch: true,
      shareImageUrl: "https://cdn.test/curso.jpg",
    });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.openGraph).toMatchObject({ siteName: "DNX", title: "Cursos de fotografía · DNX", images: [{ url: "https://cdn.test/curso.jpg" }] });
  });
});
