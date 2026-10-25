import { describe, expect, it } from "vitest";
import { acomodar, variantesDeAcomodo } from "./maquetar";

const caja = { x: 0, y: 0, w: 1000, h: 1000 };

describe("acomodo automático de una página", () => {
  it("una foto horizontal ocupa todo el ancho, centrada en alto", () => {
    const [m] = acomodar([2], caja, 20, 0);
    expect(m).toEqual({ x: 0, y: 250, w: 1000, h: 500 });
  });

  it("respeta la proporción de cada foto: nada se recorta al acomodar", () => {
    const aspectos = [1.5, 0.66, 1.5];
    for (const variante of variantesDeAcomodo(aspectos, caja, 20)) {
      variante.forEach((m, i) => expect(m.w / m.h).toBeCloseTo(aspectos[i]!, 5));
    }
  });

  it("todas las fotos quedan dentro de la página y sin pisarse", () => {
    const marcos = acomodar([1.5, 1.5, 0.75, 1], caja, 20, 0);
    for (const m of marcos) {
      expect(m.x).toBeGreaterThanOrEqual(-0.001);
      expect(m.y).toBeGreaterThanOrEqual(-0.001);
      expect(m.x + m.w).toBeLessThanOrEqual(1000.001);
      expect(m.y + m.h).toBeLessThanOrEqual(1000.001);
    }
    for (let i = 0; i < marcos.length; i++) {
      for (let j = i + 1; j < marcos.length; j++) {
        const a = marcos[i]!;
        const b = marcos[j]!;
        const seTocan = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
        expect(seTocan).toBe(false);
      }
    }
  });

  it("dos fotos horizontales en una página cuadrada van una arriba de la otra", () => {
    const [a, b] = acomodar([1.5, 1.5], caja, 20, 0);
    expect(a!.x).toBeCloseTo(b!.x, 5);
    expect(b!.y).toBeGreaterThan(a!.y + a!.h);
  });

  it("ofrece varias variantes y la vuelta se da sola", () => {
    const todas = variantesDeAcomodo([1.5, 1.5, 1.5], caja, 20);
    expect(todas.length).toBeGreaterThan(2);
    expect(acomodar([1.5, 1.5, 1.5], caja, 20, todas.length)).toEqual(todas[0]);
    expect(acomodar([1.5, 1.5, 1.5], caja, 20, -1)).toEqual(todas[todas.length - 1]);
  });
});
