import { describe, expect, it } from "vitest";
import { coincideProporcion, orientarTamano, pppDelRecorte, recorteEnPixeles, recorteInicial, recorteValido } from "./recorte";

describe("orientarTamano", () => {
  it("una foto apaisada pide el tamaño apaisado", () => {
    expect(orientarTamano(6000, 4000, 13, 18)).toEqual({ w: 18, h: 13 });
  });
  it("una foto vertical pide el tamaño vertical", () => {
    expect(orientarTamano(4000, 6000, 18, 13)).toEqual({ w: 13, h: 18 });
  });
  it("una foto cuadrada deja el tamaño como viene", () => {
    expect(orientarTamano(3000, 3000, 13, 18)).toEqual({ w: 13, h: 18 });
  });
});

describe("recorteInicial", () => {
  it("35 mm (3:2) en 10x15 no recorta", () => {
    expect(recorteInicial(6000, 4000, 10, 15)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
  it("35 mm apaisada en 13x18 recorta los costados, centrado", () => {
    const r = recorteInicial(6000, 4000, 13, 18);
    // 18x13 => 1.3846; alto completo, ancho = 4000*1.3846/6000 = 0.923
    expect(r.h).toBe(1);
    expect(r.y).toBe(0);
    expect(r.w).toBeCloseTo(0.9231, 3);
    expect(r.x).toBeCloseTo((1 - r.w) / 2, 6);
  });
  it("vertical en 20x25 recorta arriba y abajo", () => {
    const r = recorteInicial(4000, 6000, 20, 25);
    expect(r.w).toBe(1);
    expect(r.h).toBeCloseTo((4000 / 0.8) / 6000, 4);
    expect(r.y).toBeCloseTo((1 - r.h) / 2, 6);
  });
});

describe("coincideProporcion", () => {
  it("3:2 coincide con 10x15 y no con 13x18", () => {
    expect(coincideProporcion(6000, 4000, 10, 15)).toBe(true);
    expect(coincideProporcion(6000, 4000, 13, 18)).toBe(false);
  });
});

describe("pppDelRecorte", () => {
  it("6000 px de lado largo en 15 cm dan ~1016 ppp", () => {
    expect(Math.round(pppDelRecorte(6000, 4000, { x: 0, y: 0, w: 1, h: 1 }, 10, 15))).toBe(1016);
  });
  it("una foto chica en 50x70 da poca resolución", () => {
    expect(pppDelRecorte(1500, 1000, { x: 0, y: 0, w: 1, h: 1 }, 50, 70)).toBeLessThan(150);
  });
});

describe("recorteValido y recorteEnPixeles", () => {
  it("rechaza recortes fuera de la foto", () => {
    expect(recorteValido({ x: 0.5, y: 0, w: 0.6, h: 1 })).toBe(false);
    expect(recorteValido({ x: 0, y: 0, w: 0, h: 1 })).toBe(false);
    expect(recorteValido("x")).toBe(false);
    expect(recorteValido({ x: 0.1, y: 0, w: 0.8, h: 1 })).toBe(true);
  });
  it("convierte a píxeles enteros dentro de la foto", () => {
    expect(recorteEnPixeles(6000, 4000, { x: 0.1, y: 0, w: 0.8, h: 1 })).toEqual({ left: 600, top: 0, width: 4800, height: 4000 });
  });
});
