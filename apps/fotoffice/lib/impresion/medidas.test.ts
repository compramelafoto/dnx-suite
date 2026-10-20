import { describe, expect, it } from "vitest";
import { SALIDAS_INICIALES, TAMANOS_INICIALES, escalaDesdeRegla, medidaImpresaMm, mmAPx, pixelesDeHoja } from "./medidas";

describe("medidas de impresión", () => {
  it("10x15 a 300 ppp son 1205 × 1795 px (desde los mm reales, no del nombre)", () => {
    expect(pixelesDeHoja({ anchoMm: 102, altoMm: 152 }, 300)).toEqual({ ancho: 1205, alto: 1795 });
  });
  it("A4 a 300 ppp son 2480 × 3508 px", () => {
    expect(pixelesDeHoja({ anchoMm: 210, altoMm: 297 }, 300)).toEqual({ ancho: 2480, alto: 3508 });
  });
  it("mmAPx redondea al píxel más cercano", () => {
    expect(mmAPx(40, 300)).toBe(472);
  });
  it("la escala corrige lo que mide la regla impresa", () => {
    expect(escalaDesdeRegla(100)).toBe(1000);
    expect(escalaDesdeRegla(99)).toBe(1010);
    expect(escalaDesdeRegla(101)).toBe(990);
    expect(escalaDesdeRegla(80)).toBeNull();
    expect(escalaDesdeRegla(Number.NaN)).toBeNull();
  });
  it("medidaImpresaMm aplica la escala con un decimal", () => {
    expect(medidaImpresaMm(102, 1010)).toBe(103);
    expect(medidaImpresaMm(152, 1000)).toBe(152);
  });
  it("los tamaños iniciales son las medidas reales que dio Daniel", () => {
    const m = Object.fromEntries(TAMANOS_INICIALES.map((t) => [t.nombre, [t.anchoMm, t.altoMm]]));
    expect(m).toEqual({
      "10x15": [102, 152], "13x18": [127, 180], "15x20": [152, 203], "15x21": [152, 210],
      "20x30": [203, 300], "25x38": [254, 380], A4: [210, 297],
    });
  });
  it("la Epson no admite copias y la Kodak sólo hace 10x15, 13x18 y 15x20", () => {
    const kodak = SALIDAS_INICIALES.find((s) => s.nombre === "Kodak 305")!;
    const epson = SALIDAS_INICIALES.find((s) => s.nombre === "Epson L800")!;
    expect(kodak.tamanos).toEqual(["10x15", "13x18", "15x20"]);
    expect(kodak.admiteCopias).toBe(true);
    expect(epson.admiteCopias).toBe(false);
    expect(epson.tamanos).toEqual(["10x15", "A4"]);
  });
});
