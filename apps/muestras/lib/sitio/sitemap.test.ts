import { describe, expect, it } from "vitest";
import { MARCAS } from "@/lib/marca";
import { robotsDe, urlsDelSitemap, urlsFijas, xmlDelSitemap } from "./sitemap";

const PROD = { VERCEL_ENV: "production" };
const f = new Date("2026-03-04T10:00:00.000Z");
const muestras = [
  { slug: "foto-1", primaryDiscipline: "FOTOGRAFIA", updatedAt: f },
  { slug: "pintura-1", primaryDiscipline: "PINTURA", updatedAt: f },
];
const perfiles = [
  { slug: "ana", disciplines: ["FOTOGRAFIA"], updatedAt: f },
  { slug: "beto", disciplines: ["FOTOGRAFIA", "PINTURA"], updatedAt: f },
];

describe("urlsDelSitemap", () => {
  it("fotografía lista sólo las muestras y perfiles de casa fotografía", () => {
    expect(urlsDelSitemap("FOTOGRAFIA", muestras, perfiles, PROD)).toEqual([
      { loc: "https://muestrasfotograficas.com/m/foto-1", lastmod: "2026-03-04T10:00:00.000Z" },
      { loc: "https://muestrasfotograficas.com/fotografos/ana", lastmod: "2026-03-04T10:00:00.000Z" },
    ]);
  });
  it("arte lista sólo las de casa arte", () => {
    expect(urlsDelSitemap("ARTE", muestras, perfiles, PROD).map((u) => u.loc)).toEqual([
      "https://muestrasdearte.com/m/pintura-1",
      "https://muestrasdearte.com/artistas/beto",
    ]);
  });
  it("respeta el tope", () => {
    expect(urlsDelSitemap("FOTOGRAFIA", muestras, perfiles, PROD, 1)).toHaveLength(1);
  });
});

describe("urlsFijas", () => {
  it("home, convocatorias y autores de la marca", () => {
    expect(urlsFijas(MARCAS.ARTE, PROD)).toEqual([
      "https://muestrasdearte.com/", "https://muestrasdearte.com/convocatorias", "https://muestrasdearte.com/artistas",
    ]);
  });
});

describe("xmlDelSitemap", () => {
  it("escapa & < > y es un urlset", () => {
    const xml = xmlDelSitemap([{ loc: "https://x.com/m/a&b<c>", lastmod: "2026-01-01T00:00:00.000Z" }, { loc: "https://x.com/" }]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://x.com/m/a&amp;b&lt;c&gt;</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
  });
});

describe("robotsDe", () => {
  it("permite todo salvo el panel y apunta al sitemap de su dominio", () => {
    expect(robotsDe(MARCAS.ARTE, PROD)).toBe("User-agent: *\nAllow: /\nDisallow: /panel\n\nSitemap: https://muestrasdearte.com/sitemap.xml\n");
  });
});
