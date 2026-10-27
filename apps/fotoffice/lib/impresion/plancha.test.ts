import { describe, expect, it } from "vitest";
import { disposicionCarnet } from "./plancha";

describe("plancha de carnet", () => {
  it("4×4 en 10x15 a 300 ppp entran 6, de 472 px, todas dentro de la hoja", () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(d.pieza).toEqual({ ancho: 472, alto: 472 });
    expect(d.posiciones).toHaveLength(6);
    for (const p of d.posiciones) {
      expect(p.left).toBeGreaterThanOrEqual(0);
      expect(p.top).toBeGreaterThanOrEqual(0);
      expect(p.left + 472).toBeLessThanOrEqual(1205);
      expect(p.top + 472).toBeLessThanOrEqual(1795);
    }
  });
  it("respeta el tope pedido", () => {
    expect(disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300, 4).posiciones).toHaveLength(4);
  });
  it("nunca pasa de 6 por hoja aunque entren más (3x3 en 10x15 cabrían 15)", () => {
    const d = disposicionCarnet({ anchoMm: 30, altoMm: 30 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(d.posiciones).toHaveLength(6);
    expect(new Set(d.posiciones.map((p) => p.left)).size).toBe(2); // 2 columnas × 3 filas
  });
  it("un tope pedido mayor a 6 no lo supera", () => {
    expect(disposicionCarnet({ anchoMm: 25, altoMm: 30 }, { anchoMm: 102, altoMm: 152 }, 300, 20).posiciones).toHaveLength(6);
  });
  it("si por la medida entran menos de 6, pone las que entran", () => {
    expect(disposicionCarnet({ anchoMm: 45, altoMm: 70 }, { anchoMm: 102, altoMm: 152 }, 300).posiciones).toHaveLength(4);
  });
  it("las líneas de corte marcan los bordes de cada columna y fila, sin repetir", () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(new Set(d.lineas.xs).size).toBe(d.lineas.xs.length);
    expect(d.lineas.xs.length).toBe(4); // 2 columnas × 2 bordes
    expect(d.lineas.ys.length).toBe(6); // 3 filas × 2 bordes
  });
});
