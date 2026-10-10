import { describe, expect, it } from "vitest";
import {
  FRAME_SIZES, TYPICAL_IMAGE, authorIndex, catalogPlan, expectedQuality, fitInside, frameLayout, isFrameSize,
  isOrientation, largestThatFits, printPpi, printQuality, resolveOrientation,
} from "./print";

describe("orientación", () => {
  it("automática según la foto; cuadrada o sin dato, vertical", () => {
    expect(resolveOrientation("AUTO", { width: 3000, height: 2000 })).toBe("LANDSCAPE");
    expect(resolveOrientation("AUTO", { width: 2000, height: 3000 })).toBe("PORTRAIT");
    expect(resolveOrientation("AUTO", { width: 2000, height: 2000 })).toBe("PORTRAIT");
    expect(resolveOrientation("AUTO", null)).toBe("PORTRAIT");
    expect(resolveOrientation("PORTRAIT", { width: 3000, height: 2000 })).toBe("PORTRAIT");
  });
  it("valida medidas y orientaciones", () => {
    expect(isFrameSize("40x50")).toBe(true);
    expect(isFrameSize("toString")).toBe(false);
    expect(isOrientation("LANDSCAPE")).toBe(true);
    expect(isOrientation("x")).toBe(false);
  });
});

describe("fitInside", () => {
  it("entra entera, sin recorte, centrada", () => {
    const r = fitInside({ x: 10, y: 20, width: 100, height: 100 }, { width: 200, height: 100 });
    expect(r).toEqual({ x: 10, y: 45, width: 100, height: 50 });
  });
});

describe("frameLayout", () => {
  it("A4 con foto horizontal: página apaisada, margen del 12 % y abajo más ancho", () => {
    const l = frameLayout("A4", "AUTO", { width: 2000, height: 1333 });
    expect(l.orientation).toBe("LANDSCAPE");
    expect(l.page).toEqual({ width: 297, height: 210 });
    expect(l.margin).toBeCloseTo(25.2, 5);
    expect(l.window.y).toBeCloseTo(25.2 * 1.6, 5);
    expect(l.window.x).toBeCloseTo(25.2, 5);
  });
  it("la foto queda dentro de la ventana, con su proporción, centrada en horizontal", () => {
    const l = frameLayout("40x50", "PORTRAIT", { width: 2000, height: 1333 });
    expect(l.image.width / l.image.height).toBeCloseTo(2000 / 1333, 5);
    expect(l.image.x).toBeGreaterThanOrEqual(l.window.x - 1e-9);
    expect(l.image.x + l.image.width).toBeLessThanOrEqual(l.window.x + l.window.width + 1e-9);
    expect(l.image.y).toBeGreaterThanOrEqual(l.window.y - 1e-9);
    expect(l.image.x - l.window.x).toBeCloseTo(l.window.x + l.window.width - (l.image.x + l.image.width), 5);
  });
  it("el pie va debajo de la foto y la letra crece con el papel", () => {
    const chico = frameLayout("A4", "PORTRAIT", null);
    const grande = frameLayout("50x70", "PORTRAIT", null);
    expect(chico.captionTop).toBeLessThan(chico.image.y);
    expect(grande.titleSizePt).toBeGreaterThan(chico.titleSizePt);
    expect(grande.titleSizePt).toBeLessThanOrEqual(28);
    expect(chico.authorSizePt).toBeLessThan(chico.titleSizePt);
  });
  it("sin dato de la foto, la ventana entera", () => {
    const l = frameLayout("A3", "PORTRAIT", null);
    expect(l.image).toEqual(l.window);
    expect(l.page).toEqual({ width: FRAME_SIZES.A3.width, height: FRAME_SIZES.A3.height });
  });
});

describe("calidad de impresión", () => {
  it("puntos por pulgada de la foto en la caja", () => {
    expect(printPpi({ width: 2000, height: 1000 }, { x: 0, y: 0, width: 254, height: 127 })).toBe(200);
    expect(printPpi({ width: 2000, height: 1000 }, { x: 0, y: 0, width: 0, height: 127 })).toBe(0);
  });
  it("umbrales 200 y 120", () => {
    expect(printQuality(200)).toBe("GOOD");
    expect(printQuality(199)).toBe("FAIR");
    expect(printQuality(120)).toBe("FAIR");
    expect(printQuality(119)).toBe("LOW");
  });
  it("con las fotos web de 2000 px: A4 buena, hasta 40×50 aceptable, 50×70 blanda", () => {
    expect(TYPICAL_IMAGE).toEqual({ width: 2000, height: 1333 });
    expect(expectedQuality("A4")).toBe("GOOD");
    expect(expectedQuality("A3")).toBe("FAIR");
    expect(expectedQuality("30x40")).toBe("FAIR");
    expect(expectedQuality("40x50")).toBe("FAIR");
    expect(expectedQuality("50x70")).toBe("LOW");
  });
});

describe("largestThatFits", () => {
  it("el más grande que entra; si ninguno, el más chico", () => {
    expect(largestThatFits([16, 14, 12, 10], (s) => s <= 13)).toBe(12);
    expect(largestThatFits([16, 14, 12, 10], () => false)).toBe(10);
    expect(() => largestThatFits([], () => true)).toThrow();
  });
});

describe("catálogo", () => {
  it("portada, texto, obras, índice y cierre", () => {
    expect(catalogPlan(2, 3, 1)).toEqual({
      coverPage: 1, curatorialFirstPage: 2, firstWorkPage: 4, indexFirstPage: 7, closingPage: 8, totalPages: 8,
    });
  });
  it("sin texto curatorial las obras empiezan en la 2", () => {
    expect(catalogPlan(0, 1, 1)).toEqual({
      coverPage: 1, curatorialFirstPage: null, firstWorkPage: 2, indexFirstPage: 3, closingPage: 4, totalPages: 4,
    });
  });
  it("índice de autores: alfabético, junta mayúsculas y acentos, sin autor al final", () => {
    expect(authorIndex([
      { authorName: "Zoe Ruiz", page: 2 },
      { authorName: "ana pérez", page: 3 },
      { authorName: "Ana Perez", page: 5 },
      { authorName: " ", page: 6 },
      { authorName: "Álvaro Gil", page: 4 },
    ])).toEqual([
      { author: "Álvaro Gil", pages: [4] },
      { author: "ana pérez", pages: [3, 5] },
      { author: "Zoe Ruiz", pages: [2] },
      { author: "Autor sin indicar", pages: [6] },
    ]);
  });
});
