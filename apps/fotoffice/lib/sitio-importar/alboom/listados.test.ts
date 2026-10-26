import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { idDeRuta, leerListadoGalerias, leerListadoTrabajos, leerSitemap, leerTrabajosDeLaPortada } from "./listados";

const fx = (n: string) => readFileSync(join(__dirname, "__fixtures__", n), "utf8");

describe("listados de Alboom", () => {
  it("/portfolio: 12 trabajos y 4 páginas en total", () => {
    const l = leerListadoTrabajos(fx("portfolio.html"));
    expect(l.paginas).toBe(4);
    expect(l.rutas).toHaveLength(12);
    expect(l.rutas).toContain("/portfolio/books/1465286-book-emma-pre-xv");
  });

  it("una página pedida por AJAX trae sólo las tarjetas", () => {
    expect(leerListadoTrabajos(fx("portfolio-pagina-4.html"))).toEqual({
      rutas: ["/portfolio/books/296936-bookandy", "/portfolio/bodas/294891-eli", "/portfolio/books/294876-martu15", "/portfolio/books/293824-jime15"],
      paginas: 1,
    });
  });

  it("/galerias: las 5 galerías", () => {
    expect(leerListadoGalerias(fx("galerias.html"))).toEqual([
      "/gallery/12070-books",
      "/gallery/12073-bodas",
      "/gallery/19953-cumple-de-15-en-rosario-santa-fe-argentina-dnxfotografia-daniel-cuart",
      "/gallery/21382-videos",
      "/gallery/87092-fiestas-de-15-en-rosario-fotografo-de-rosario",
    ]);
  });

  it("sitemap: los 31 artículos y las landings, sin dominio", () => {
    const rutas = leerSitemap(fx("sitemap.xml"));
    expect(rutas.filter((r) => r.startsWith("/post/"))).toHaveLength(31);
    expect(rutas).toContain("/los15depia");
    expect(rutas).toContain("/post/320993-ServicioQR");
    expect(rutas[0]).toBe("/");
  });

  it("los trabajos que enlaza la portada, en orden", () => {
    const rutas = leerTrabajosDeLaPortada(fx("portada.html"));
    expect(rutas.length).toBeGreaterThanOrEqual(5);
    expect(rutas.every((r) => r.startsWith("/portfolio/"))).toBe(true);
  });

  it("número de Alboom de una ruta", () => {
    expect(idDeRuta("/portfolio/books/1465286-book-emma-pre-xv")).toBe("1465286");
    expect(idDeRuta("/gallery/12070-books")).toBe("12070");
    expect(idDeRuta("/sobre")).toBeNull();
  });
});
