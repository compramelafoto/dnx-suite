import { describe, expect, it } from "vitest";
import {
  desplazar,
  dimensionesRotadas,
  ENCUADRE_INICIAL as I,
  escalaMinima,
  normalizarEncuadre,
  transformacion,
} from "./encuadre";

const RECT = { w: 50, h: 70 };
const FOTO = { w: 3000, h: 2000 };

/** Las cuatro esquinas del cuadro llevadas a píxeles de la foto (ya rotada de a 90°). */
function esquinasEnLaFoto(e: typeof I) {
  const { s, theta, fx, fy } = transformacion(e, RECT, FOTO);
  const c = Math.cos(-theta), sn = Math.sin(-theta);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const x = (a * RECT.w) / 2, y = (b * RECT.h) / 2;
    return { x: fx + (x * c - y * sn) / s, y: fy + (x * sn + y * c) / s };
  });
}

describe("el encuadre de una foto", () => {
  it("el encuadre inicial cubre el cuadro sin girar", () => {
    expect(transformacion(I, RECT, FOTO).s).toBeCloseTo(70 / 2000, 12);
  });

  it("inclinar exige más zoom", () => {
    expect(escalaMinima(RECT, FOTO, { ...I, incl: 15 })).toBeGreaterThan(1);
    expect(escalaMinima(RECT, FOTO, I)).toBeCloseTo(1, 12);
  });

  it("normalizar nunca deja esquinas vacías, aun inclinada al máximo y corrida al borde", () => {
    const e = normalizarEncuadre({ ...I, incl: 15, escala: 1, cx: 0, cy: 1 }, RECT, FOTO);
    expect(e.escala).toBeGreaterThanOrEqual(escalaMinima(RECT, FOTO, e) - 1e-9);
    for (const p of esquinasEnLaFoto(e)) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(FOTO.w + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeLessThanOrEqual(FOTO.h + 1e-6);
    }
  });

  it("limita la inclinación a ±15°", () => {
    expect(normalizarEncuadre({ ...I, incl: 40 }, RECT, FOTO).incl).toBe(15);
    expect(normalizarEncuadre({ ...I, incl: -40 }, RECT, FOTO).incl).toBe(-15);
  });

  it("rotar 90° intercambia los lados de la foto", () => {
    expect(dimensionesRotadas(FOTO, 90)).toEqual({ w: 2000, h: 3000 });
    expect(dimensionesRotadas(FOTO, 180)).toEqual(FOTO);
  });

  it("arrastrar la foto a la derecha muestra lo que está más a la izquierda", () => {
    const e = desplazar({ ...I, escala: 2 }, 5, 0, RECT, FOTO);
    expect(e.cx).toBeLessThan(0.5);
    expect(e.cy).toBeCloseTo(0.5, 12);
  });
});
