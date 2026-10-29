import { describe, expect, it } from "vitest";
import { leerEstadoFotolibro } from "../modo/estado";
import { DISENOS_TAPA, bloquesDeTapa, tapaDelLibro } from "./bloques";

const foto = (id: string) => ({ id, url: `https://x/${id}.jpg`, vista: `https://x/${id}-v.jpg`, mini: "", w: 6000, h: 4000, nombre: id });
const pliego = { anchoMm: 610, altoMm: 305 };

function estado(tapa: Record<string, unknown>, textos: Record<string, string> = {}) {
  return leerEstadoFotolibro({ fotolibro: { fotos: [foto("a"), foto("b")], tapa, estilo: { id: "bodas-01-jardin-acuarela", medida: "610×305", fondos: {}, textos } } }, 10);
}

describe("bloques de la tapa", () => {
  it("sin modelo no hay tapa", () => {
    expect(bloquesDeTapa(leerEstadoFotolibro({}, 10), 10, pliego)).toEqual([]);
  });

  it("en el frente de Román la foto cubre toda la pieza, demasía incluida", () => {
    const e = estado({ modeloId: "roman-gold-premium-30x60", fotoId: "a", encuadre: { zoom: 1.4, x: 0.2, y: 0 } });
    const { lienzo } = tapaDelLibro(e, 10)!;
    expect(lienzo).toEqual({ width: 3602, height: 4075, dpi: 300 });
    const f = bloquesDeTapa(e, 10, pliego).find((b) => b.id === "tapa-foto")!;
    expect(f.layout).toMatchObject({ x: 0, y: 0 });
    expect(Math.round(f.layout.width)).toBe(3602);
    expect(f.configJson.crop).toEqual({ zoom: 1.4, x: 0.2, y: 0 });
  });

  it("el título va sobre una franja en la cara de la tapa, no en la demasía", () => {
    const e = estado({ modeloId: "roman-gold-premium-30x60", fotoId: "a" }, { titulo: "Ana & Juan", fecha: "12 de octubre" });
    const bloques = bloquesDeTapa(e, 10, pliego);
    const franja = bloques.find((b) => b.id === "tapa-franja")!;
    const izq = (19.9 * 300) / 25.4;
    expect(franja.layout.x).toBeCloseTo(izq, 0);
    expect(bloques.find((b) => b.id === "tapa-titulo")!.configJson.content).toBe("Ana & Juan");
    expect(bloques.some((b) => b.id === "tapa-subtitulo")).toBe(true);
  });

  it("en la flexible la contratapa va a la izquierda y lleva la frase si no tiene foto", () => {
    const e = estado({ modeloId: "flexible-flexible-30x60", fotoId: "a" }, { frase: "Para siempre" });
    const bloques = bloquesDeTapa(e, 10, pliego);
    const f = bloques.find((b) => b.id === "tapa-foto")!;
    expect(f.layout.x).toBeCloseTo((310 * 300) / 25.4, 0);
    const frase = bloques.find((b) => b.id === "contratapa-frase")!;
    expect(frase.layout.x).toBeLessThan(f.layout.x);
  });

  it("cada diseño genérico arma su portada; el tipográfico no lleva foto y el de sólo foto no lleva título", () => {
    for (const d of DISENOS_TAPA) {
      const e = estado({ modeloId: "generica-rigido-30x60", fotoId: "a", diseno: d.id }, { titulo: "Viaje a Bariloche" });
      const b = bloquesDeTapa(e, 10, pliego);
      expect(b.some((x) => x.id === "tapa-foto")).toBe(d.id !== "tipografica");
      expect(b.some((x) => x.id === "tapa-titulo")).toBe(d.id !== "sin-texto");
    }
  });

  it("los textos propios de la tapa mandan sobre los del estilo", () => {
    const e = estado({ modeloId: "generica-rigido-30x60", fotoId: "a", textos: { titulo: "Nuestro año" } }, { titulo: "Ana & Juan" });
    expect(bloquesDeTapa(e, 10, pliego).find((x) => x.id === "tapa-titulo")!.configJson.content).toBe("Nuestro año");
  });

  it("con lomo de 8 mm o más, el título va a lo largo del lomo", () => {
    const con = bloquesDeTapa(estado({ modeloId: "generica-rigido-30x60", fotoId: "a" }, { titulo: "Ana & Juan" }), 20, pliego);
    expect(con.find((x) => x.id === "lomo-titulo")!.layout.rotation).toBe(90);
    const sin = bloquesDeTapa(estado({ modeloId: "generica-rigido-30x60", fotoId: "a" }, { titulo: "Ana & Juan" }), 2, pliego);
    expect(sin.some((x) => x.id === "lomo-titulo")).toBe(false);
  });
});
