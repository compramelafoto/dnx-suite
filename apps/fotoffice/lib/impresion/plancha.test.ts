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
  it("las líneas de corte marcan los bordes de cada columna y fila, sin repetir", () => {
    const d = disposicionCarnet({ anchoMm: 40, altoMm: 40 }, { anchoMm: 102, altoMm: 152 }, 300);
    expect(new Set(d.lineas.xs).size).toBe(d.lineas.xs.length);
    expect(d.lineas.xs.length).toBe(4); // 2 columnas × 2 bordes
    expect(d.lineas.ys.length).toBe(6); // 3 filas × 2 bordes
  });
});
