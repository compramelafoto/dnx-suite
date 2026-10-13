import { describe, expect, it } from "vitest";
import { modeloDelLibrito, tamanoTextura } from "./modelo-librito";

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

describe("tamanoTextura", () => {
  it("achica respetando la proporción", () => {
    expect(tamanoTextura(3602, 2421)).toEqual({ w: 2048, h: 1377 });
  });
  it("no agranda lo chico", () => {
    expect(tamanoTextura(800, 600)).toEqual({ w: 800, h: 600 });
  });
});
