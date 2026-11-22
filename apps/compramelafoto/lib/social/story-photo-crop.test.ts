import { describe, expect, it } from "vitest";
import { asignarFotosAHuecos, carasValidas, encuadrarCaras, fotosConCarasBuenas, fraccionVisible } from "./story-photo-crop";

const dentro = (r: { left: number; top: number; width: number; height: number }, imgW: number, imgH: number) =>
  r.left >= 0 && r.top >= 0 && r.left + r.width <= imgW && r.top + r.height <= imgH;

describe("encuadrarCaras", () => {
  it("sin caras devuelve null (se usa el recorte por zona de interés)", () => {
    expect(encuadrarCaras({ imgW: 1600, imgH: 1067, huecoW: 300, huecoH: 600, caras: [] })).toBeNull();
  });

  it("en una foto horizontal con hueco vertical, centra la cara que está a la derecha", () => {
    const r = encuadrarCaras({
      imgW: 1600,
      imgH: 1067,
      huecoW: 300,
      huecoH: 600,
      caras: [{ left: 0.7, top: 0.2, width: 0.08, height: 0.12 }],
    })!;
    expect(r.width / r.height).toBeCloseTo(0.5, 2);
    expect(r.height).toBe(1067); // sin zoom: usa todo el alto
    const caraX = (0.7 + 0.04) * 1600;
    expect(caraX).toBeGreaterThan(r.left);
    expect(caraX).toBeLessThan(r.left + r.width);
    expect(Math.abs(caraX - (r.left + r.width / 2))).toBeLessThan(5);
    expect(dentro(r, 1600, 1067)).toBe(true);
  });

  it("en una franja horizontal no corta la cabeza: deja aire arriba", () => {
    const cara = { left: 0.45, top: 0.1, width: 0.1, height: 0.08 };
    const r = encuadrarCaras({ imgW: 1067, imgH: 1600, huecoW: 1080, huecoH: 300, caras: [cara] })!;
    const y0 = cara.top * 1600;
    const y1 = (cara.top + cara.height) * 1600;
    expect(r.top).toBeLessThanOrEqual(y0);
    expect(r.top + r.height).toBeGreaterThanOrEqual(y1);
    expect(dentro(r, 1067, 1600)).toBe(true);
  });

  it("con un grupo, entran todas las caras relevantes", () => {
    const caras = [
      { left: 0.1, top: 0.3, width: 0.08, height: 0.1 },
      { left: 0.3, top: 0.32, width: 0.08, height: 0.1 },
      { left: 0.5, top: 0.31, width: 0.08, height: 0.1 },
    ];
    const r = encuadrarCaras({ imgW: 1600, imgH: 1067, huecoW: 600, huecoH: 600, caras })!;
    for (const c of caras) {
      expect(c.left * 1600).toBeGreaterThanOrEqual(r.left);
      expect((c.left + c.width) * 1600).toBeLessThanOrEqual(r.left + r.width);
    }
  });

  it("las caras chicas del fondo no corren el encuadre", () => {
    const protagonista = { left: 0.7, top: 0.25, width: 0.12, height: 0.18 };
    const publico = { left: 0.02, top: 0.1, width: 0.02, height: 0.03 };
    const r = encuadrarCaras({ imgW: 1600, imgH: 1067, huecoW: 400, huecoH: 800, caras: [protagonista, publico] })!;
    const cx = (protagonista.left + protagonista.width / 2) * 1600;
    expect(cx).toBeGreaterThan(r.left);
    expect(cx).toBeLessThan(r.left + r.width);
  });

  it("nunca se sale de la foto aunque la cara esté en el borde", () => {
    const r = encuadrarCaras({
      imgW: 1600,
      imgH: 1067,
      huecoW: 300,
      huecoH: 600,
      caras: [{ left: 0.97, top: 0.0, width: 0.03, height: 0.05 }],
    })!;
    expect(dentro(r, 1600, 1067)).toBe(true);
  });
});

describe("selección de fotos con caras", () => {
  it("deja las que tienen una cara visible y descarta multitudes de caritas o sin caras", () => {
    const caras = new Map([
      [1, [{ left: 0.4, top: 0.2, width: 0.1, height: 0.15 }]],
      [2, Array.from({ length: 30 }, () => ({ left: 0.1, top: 0.1, width: 0.02, height: 0.03 }))],
      [3, []],
    ]);
    expect(fotosConCarasBuenas([1, 2, 3, 4], caras)).toEqual([1]);
  });

  it("descarta cajas mal formadas", () => {
    expect(carasValidas([{ left: 0.1, top: 0.1, width: 0.1, height: 0.1 }, { left: "x" }, null, { left: 0, top: 0, width: 0, height: 0.1 }])).toHaveLength(1);
  });
});

describe("asignarFotosAHuecos: cada foto en el hueco que mejor le queda", () => {
  it("la foto vertical va al hueco vertical y la horizontal al ancho", () => {
    // fotos: [horizontal 1,5 ; vertical 0,67] — huecos: [vertical 0,5 ; ancho 3]
    expect(asignarFotosAHuecos([1.5, 0.67], [0.5, 3])).toEqual([1, 0]);
  });

  it("con 4 fotos encuentra el mejor reparto y no repite ninguna", () => {
    const r = asignarFotosAHuecos([1.5, 0.67, 1.5, 0.67], [0.6, 1.6, 0.6, 1.6]);
    expect(new Set(r).size).toBe(4);
    expect(r.map((f) => [1.5, 0.67, 1.5, 0.67][f])).toEqual([0.67, 1.5, 0.67, 1.5]);
  });

  it("si todas tienen la misma forma, respeta el orden", () => {
    expect(asignarFotosAHuecos([1.5, 1.5, 1.5], [0.5, 1, 2])).toEqual([0, 1, 2]);
  });

  it("acomodar por forma conserva más imagen que el orden original", () => {
    const fotos = [1.5, 0.67];
    const huecos = [0.5, 3];
    const total = (orden: number[]) => orden.reduce((a, f, h) => a + fraccionVisible(fotos[f]!, huecos[h]!), 0);
    expect(total(asignarFotosAHuecos(fotos, huecos))).toBeGreaterThan(total([0, 1]));
  });
});
