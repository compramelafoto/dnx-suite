import { describe, expect, it } from "vitest";
import { AJUSTES_NEUTROS, TOPES, ajustarPixel, aplicarAjustes, esNeutro, esquemaAjustes, type Ajustes } from "./ajustes";

const con = (p: Partial<Ajustes>): Ajustes => ({ ...AJUSTES_NEUTROS, ...p });
const cerca = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d);

describe("ajustes de revelado", () => {
  it("todo en 0 no cambia ni un valor (8 y 16 bits)", () => {
    const ocho = Uint8ClampedArray.from([0, 17, 128, 255, 1, 2, 250, 255]);
    const copia8 = ocho.slice();
    aplicarAjustes(ocho, 4, AJUSTES_NEUTROS);
    expect([...ocho]).toEqual([...copia8]);
    const dieciseis = Uint16Array.from([0, 1000, 65535, 32768, 12, 40000]);
    const copia16 = dieciseis.slice();
    aplicarAjustes(dieciseis, 3, AJUSTES_NEUTROS);
    expect([...dieciseis]).toEqual([...copia16]);
    expect(esNeutro(AJUSTES_NEUTROS)).toBe(true);
  });
  it("exposición +50 es un paso: un gris de 0,25 pasa a 0,5", () => {
    const [r] = ajustarPixel(0.25, 0.25, 0.25, con({ exposicion: 50 }));
    cerca(r, 0.5);
  });
  it("temperatura +50 calienta: sube el rojo y baja el azul en el tope", () => {
    const [r, g, b] = ajustarPixel(0.5, 0.5, 0.5, con({ temperatura: 50 }));
    cerca(r, 0.5 + TOPES.temperatura);
    cerca(g, 0.5);
    cerca(b, 0.5 - TOPES.temperatura);
  });
  it("saturación no cambia un gris", () => {
    const [r, g, b] = ajustarPixel(0.4, 0.4, 0.4, con({ saturacion: 50, intensidad: 50 }));
    cerca(r, 0.4); cerca(g, 0.4); cerca(b, 0.4);
  });
  it("contraste deja quietos el negro, el gris medio y el blanco", () => {
    for (const v of [0, 0.5, 1]) {
      const [r] = ajustarPixel(v, v, v, con({ contraste: 50 }));
      cerca(r, v);
    }
    const [claro] = ajustarPixel(0.75, 0.75, 0.75, con({ contraste: 50 }));
    expect(claro).toBeGreaterThan(0.75);
  });
  it("negros +50 levanta el negro puro sin pasarse del tope", () => {
    const [r] = ajustarPixel(0, 0, 0, con({ negros: 50 }));
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(TOPES.blancosNegros);
  });
  it("con todo al máximo, nada se sale de 0..1", () => {
    const max = con({ exposicion: 50, contraste: 50, luces: 50, sombras: 50, blancos: 50, negros: 50, temperatura: 50, tinte: 50, saturacion: 50, intensidad: 50 });
    for (const v of [0, 0.1, 0.5, 0.9, 1]) {
      for (const x of ajustarPixel(v, v * 0.8, v * 0.3, max)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(1);
      }
    }
  });
  it("la intensidad satura menos un tono de piel que un azul igual de apagado", () => {
    const a = con({ intensidad: 50 });
    const piel = ajustarPixel(0.8, 0.6, 0.5, a);
    const azul = ajustarPixel(0.5, 0.6, 0.8, a);
    const sat = ([r, g, b]: number[]) => Math.max(r!, g!, b!) - Math.min(r!, g!, b!);
    expect(sat(piel)).toBeLessThan(sat(azul));
  });
  it("el esquema sólo acepta enteros de −50 a 50 en las 10 claves", () => {
    expect(esquemaAjustes.safeParse(AJUSTES_NEUTROS).success).toBe(true);
    expect(esquemaAjustes.safeParse(con({ contraste: 51 })).success).toBe(false);
    expect(esquemaAjustes.safeParse(con({ contraste: 1.5 })).success).toBe(false);
    expect(esquemaAjustes.safeParse({ ...AJUSTES_NEUTROS, otra: 1 }).success).toBe(false);
  });
});
