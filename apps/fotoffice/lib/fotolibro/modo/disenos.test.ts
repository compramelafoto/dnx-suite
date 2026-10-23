import { describe, expect, it } from "vitest";
import { disenosDePliego, type Zonas } from "./disenos";

// Un pliego 30x60 a 300 ppp, con 12 mm de margen (142 px) y 4 mm de separación (47 px).
const W = 7205;
const H = 3602;
const m = 142;
const zonas: Zonas = {
  lienzo: { x: 0, y: 0, w: W, h: H },
  izq: { x: m, y: m, w: W / 2 - 2 * m, h: H - 2 * m },
  der: { x: W / 2 + m, y: m, w: W / 2 - 2 * m, h: H - 2 * m },
};
const sep = 47;
const cruzaElLomo = (c: { x: number; w: number }) => c.x < W / 2 - 2 && c.x + c.w > W / 2 + 2;

describe("distribuciones del pliego entero", () => {
  it("una foto apaisada va a todo el pliego, a sangre", () => {
    const [primera] = disenosDePliego([2], zonas, sep);
    expect(primera).toEqual([{ x: 0, y: 0, w: W, h: H }]);
  });

  it("cuatro fotos ofrecen muchas distribuciones, todas con las cuatro", () => {
    const todas = disenosDePliego([1.5, 1.5, 0.67, 1.5], zonas, sep);
    expect(todas.length).toBeGreaterThan(30);
    for (const d of todas) expect(d).toHaveLength(4);
  });

  it("hay una con una página entera a sangre y las otras fotos en la otra", () => {
    const todas = disenosDePliego([0.7, 1.5, 1.5, 1.5], zonas, sep);
    expect(todas.some((d) => d[0]!.x === 0 && d[0]!.y === 0 && Math.abs(d[0]!.w - W / 2) < 1 && d[0]!.h === H)).toBe(true);
  });

  it("de entrada se prefiere llenar el pliego antes que dejar aire", () => {
    const [primera] = disenosDePliego([1.5, 1.5, 0.67, 1.5], zonas, sep);
    const area = primera!.reduce((s, c) => s + c.w * c.h, 0);
    expect(area / (W * H)).toBeGreaterThan(0.75);
  });

  it("las fotos chicas nunca quedan partidas por el lomo", () => {
    for (const d of disenosDePliego([1.5, 1.5, 1.5, 1.5, 1.5, 1.5], zonas, sep)) {
      for (const c of d) if (cruzaElLomo(c)) expect(c.w).toBeGreaterThanOrEqual(W * 0.6);
    }
  });

  it("las fotos de un diseño no se pisan", () => {
    for (const d of disenosDePliego([1.5, 0.67, 1.5, 1, 1.5], zonas, sep).slice(0, 40)) {
      for (let i = 0; i < d.length; i++)
        for (let j = i + 1; j < d.length; j++) {
          const a = d[i]!;
          const b = d[j]!;
          const pisa = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
          expect(pisa).toBe(false);
        }
    }
  });

  it("doce fotos todavía se acomodan rápido", () => {
    const t = performance.now();
    const todas = disenosDePliego(Array(12).fill(1.5), zonas, sep);
    expect(todas.length).toBeGreaterThan(5);
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
