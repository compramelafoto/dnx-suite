import { describe, expect, it } from "vitest";
import { giroMasCercano, giroParaLeer, modeloDelLibrito, tamanoTextura, type BloqueParaLeer } from "./modelo-librito";

describe("modeloDelLibrito", () => {
  it("la carpeta apaisada de 2 páginas es una hoja doblada al medio", () => {
    const m = modeloDelLibrito(3602, 2421, 2);
    expect(m.tipo).toBe("plegado");
    if (m.tipo !== "plegado") return;
    expect(m.anchoMitad).toBeCloseTo(3602 / 2421 / 2);
    expect(m.exterior).toBe(0);
    expect(m.interior).toBe(1);
  });

  it("un diseño vertical de 2 páginas es una hoja con frente y dorso", () => {
    const m = modeloDelLibrito(1200, 1800, 2);
    expect(m).toEqual({ tipo: "hojas", ancho: 1200 / 1800, hojas: [{ frente: 0, dorso: 1 }] });
  });

  it("con páginas impares la última hoja queda con el dorso en blanco", () => {
    const m = modeloDelLibrito(1800, 1200, 3);
    expect(m.tipo).toBe("hojas");
    if (m.tipo !== "hojas") return;
    expect(m.hojas).toEqual([
      { frente: 0, dorso: 1 },
      { frente: 2, dorso: null },
    ]);
  });

  it("una sola página es una hoja suelta", () => {
    const m = modeloDelLibrito(1000, 1000, 1);
    expect(m).toEqual({ tipo: "hojas", ancho: 1, hojas: [{ frente: 0, dorso: null }] });
  });
});

describe("giroParaLeer", () => {
  const W = 3602;
  const H = 2421;
  const b = (
    type: string,
    pageIndex: number,
    x: number,
    width: number,
    rotation: number,
    height = 200,
  ): BloqueParaLeer => ({ type, pageIndex, layout: { x, y: 100, width, height, rotation, visible: true } });
  // Como San Patricio: tapa derecha derecha, contratapa izquierda a +90, interior a -90.
  const sanPatricio: BloqueParaLeer[] = [
    b("SHAPE", 0, 0, W, 45, H),
    b("TEXT", 0, 2100, 1200, 0),
    b("TEXT", 0, 200, 1200, 90, 900),
    b("VARIABLE_TEXT", 0, 600, 400, 90),
    b("TEXT", 1, 300, 1000, -90),
    b("TEXT", 1, 2200, 1000, -90),
    b("IMAGE", 1, 0, W, 0, H),
  ];

  it("la tapa (mitad derecha) con texto derecho no necesita giro", () => {
    expect(giroParaLeer(sanPatricio, { pageIndex: 0, mitad: "derecha", canvasW: W })).toBe(0);
  });

  it("el interior con textos a -90 se lee girando la vista +90", () => {
    expect(giroParaLeer(sanPatricio, { pageIndex: 1, mitad: null, canvasW: W })).toBe(90);
  });

  it("de frente, un texto a +90 se lee con la vista a -90", () => {
    expect(giroParaLeer(sanPatricio, { pageIndex: 0, mitad: "izquierda", canvasW: W })).toBe(-90);
  });

  it("la contratapa, que se ve dando vuelta el librito, con textos a +90 se lee con la vista a +90", () => {
    expect(giroParaLeer(sanPatricio, { pageIndex: 0, mitad: "izquierda", canvasW: W, deEspaldas: true })).toBe(90);
  });

  it("redondea al múltiplo de 90 más cercano y gana la orientación con más superficie", () => {
    const bloques = [b("TEXT", 0, 0, 100, 87), b("TEXT", 0, 0, 1000, 182), b("TEXT", 0, 0, 300, -3)];
    expect(giroParaLeer(bloques, { pageIndex: 0, mitad: null, canvasW: W })).toBe(180);
    expect(giroParaLeer(bloques, { pageIndex: 0, mitad: null, canvasW: W, deEspaldas: true })).toBe(180);
  });

  it("un texto a 270 cuenta como -90", () => {
    expect(giroParaLeer([b("TEXT", 0, 0, 100, 270)], { pageIndex: 0, mitad: null, canvasW: W })).toBe(90);
  });

  it("sin textos en esa cara devuelve null; los ocultos no cuentan", () => {
    expect(giroParaLeer(sanPatricio, { pageIndex: 2, mitad: null, canvasW: W })).toBeNull();
    const oculto: BloqueParaLeer = { type: "TEXT", pageIndex: 0, layout: { x: 0, y: 0, width: 10, height: 10, rotation: 90, visible: false } };
    expect(giroParaLeer([oculto], { pageIndex: 0, mitad: null, canvasW: W })).toBeNull();
  });
});

describe("giroMasCercano", () => {
  it("elige el equivalente más cercano para girar por el camino corto", () => {
    expect(giroMasCercano(0, 90)).toBe(90);
    expect(giroMasCercano(360, 90)).toBe(450);
    expect(giroMasCercano(90, -90)).toBe(270);
    expect(giroMasCercano(-270, 0)).toBe(-360);
    expect(giroMasCercano(450, -90)).toBe(630);
    expect(giroMasCercano(10, 10)).toBe(10);
  });
});

describe("tamanoTextura", () => {
  it("achica respetando la proporción", () => {
    expect(tamanoTextura(3602, 2421)).toEqual({ w: 2048, h: 1377 });
  });
  it("no agranda lo chico", () => {
    expect(tamanoTextura(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
