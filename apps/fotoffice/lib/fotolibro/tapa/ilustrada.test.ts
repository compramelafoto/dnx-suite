import { describe, expect, it } from "vitest";
import { ESTILOS } from "../estilos/catalogo";
import { leerEstadoFotolibro } from "../modo/estado";
import { bloquesDeTapa, tapaDelLibro } from "./bloques";
import { modeloTapaPorId } from "./catalogo";
import { geometriaTapa } from "./geometria";
import { claveDeArte, fotoDePortada, svgDeTapaIlustrada, textosDePortada } from "./ilustrada";

const g = geometriaTapa(modeloTapaPorId("generica-rigido-30x60")!, 20);
const gFlex = geometriaTapa(modeloTapaPorId("flexible-flexible-30x60")!, 10);
const gFrente = geometriaTapa(modeloTapaPorId("roman-gold-premium-30x60")!, 10);

describe("portadas ilustradas por temática", () => {
  it("los 170 estilos dibujan su portada en los tres tipos de tapa, con ids que no chocan", () => {
    expect(ESTILOS.length).toBeGreaterThanOrEqual(170);
    for (const e of ESTILOS) {
      for (const geo of [g, gFlex, gFrente]) {
        const svg = svgDeTapaIlustrada(e, geo);
        expect(svg.startsWith("<svg")).toBe(true);
        const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("el frente (sin contratapa) sólo dibuja la portada; la completa, portada y cierre", () => {
    const e = ESTILOS[0]!;
    expect(svgDeTapaIlustrada(e, gFrente).match(/<svg x=/g)).toHaveLength(2);
    expect(svgDeTapaIlustrada(e, g).match(/<svg x=/g)).toHaveLength(4);
  });

  it("los títulos y la foto caen dentro de la cara de la tapa", () => {
    for (const e of ESTILOS.slice(0, 40)) {
      for (const t of textosDePortada(e, g.tapa)) {
        expect(t.x).toBeGreaterThanOrEqual(g.tapa.x - 0.5);
        expect(t.x + t.w).toBeLessThanOrEqual(g.tapa.x + g.tapa.w + 0.5);
      }
      const f = fotoDePortada(e, g.tapa);
      expect(f.x).toBeGreaterThanOrEqual(g.tapa.x);
      expect(f.x + f.w).toBeLessThanOrEqual(g.tapa.x + g.tapa.w + 0.5);
    }
  });

  it("usa el dibujo subido sólo si es para esta medida; si cambian las hojas, espera el nuevo", () => {
    const estilo = ESTILOS[0]!;
    const base = (hojas: number, clave: string) =>
      leerEstadoFotolibro(
        { templatePageCount: hojas, fotolibro: { fotos: [], estilo: { id: estilo.id, medida: "", fondos: {}, textos: { titulo: "Ana & Juan" } }, tapa: { modeloId: "generica-rigido-30x60", diseno: "ilustrada", arte: { clave, url: "https://r2/portada.jpg" } } } },
        hojas,
      );
    const clave = claveDeArte(estilo.id, "generica-rigido-30x60", tapaDelLibro(base(20, ""), 20)!.geometria);
    const fondo = (e: ReturnType<typeof base>, hojas: number) => bloquesDeTapa(e, hojas, { anchoMm: 610, altoMm: 305 }).find((b) => b.id === "tapa-fondo")!;
    expect(fondo(base(20, clave), 20).configJson.src).toBe("https://r2/portada.jpg");
    expect(fondo(base(24, clave), 24).configJson.src).toBe("");
    expect(bloquesDeTapa(base(20, clave), 20, { anchoMm: 610, altoMm: 305 }).some((b) => b.id === "tapa-titulo")).toBe(true);
  });
});
