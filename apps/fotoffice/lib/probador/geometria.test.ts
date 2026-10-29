import { describe, expect, it } from "vitest";
import {
  aLaPared,
  COMPOSICIONES,
  cuadrosDe,
  esquinasDeReferencia,
  homografia,
  invertir,
  medidaDelConjunto,
  proyectar,
} from "./geometria";

const FOTO = [
  { x: 250, y: 120 },
  { x: 1610, y: 175 },
  { x: 1610, y: 885 },
  { x: 250, y: 945 },
];

describe("la homografía de la pared", () => {
  const H = homografia(esquinasDeReferencia(380, 260), FOTO)!;

  it("lleva cada esquina marcada a su lugar en la foto", () => {
    esquinasDeReferencia(380, 260).forEach((p, i) => {
      const q = proyectar(H, p.x, p.y);
      expect(q.x).toBeCloseTo(FOTO[i].x, 6);
      expect(q.y).toBeCloseTo(FOTO[i].y, 6);
    });
  });

  it("vuelve de la foto a la pared con la inversa", () => {
    const Hi = invertir(H);
    const q = proyectar(H, 123, 45);
    const p = aLaPared(Hi, q)!;
    expect(p.x).toBeCloseTo(123, 6);
    expect(p.y).toBeCloseTo(45, 6);
  });

  it("no inventa una homografía con tres esquinas alineadas", () => {
    const alineadas = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 10 }];
    expect(homografia(esquinasDeReferencia(100, 100), alineadas)).toBeNull();
  });

  it("tampoco con dos esquinas cruzadas (una esquina arrastrada de más)", () => {
    const cruzadas = [FOTO[0], FOTO[2], FOTO[1], FOTO[3]];
    expect(homografia(esquinasDeReferencia(380, 260), cruzadas)).toBeNull();
  });
});

describe("las composiciones", () => {
  it("el tríptico de 50 × 70 con 5 cm de separación mide 160 × 70", () => {
    expect(medidaDelConjunto(cuadrosDe("triptico", 50, 70, 5))).toEqual({ w: 160, h: 70 });
  });

  it("en la galería los cuatro chicos suman la altura del grande", () => {
    const cuadros = cuadrosDe("galeria", 50, 70, 4);
    expect(cuadros).toHaveLength(5);
    expect(medidaDelConjunto(cuadros).h).toBeCloseTo(70, 9);
  });

  it("el tríptico central achica los laterales y los centra en alto", () => {
    const [izq, centro, der] = cuadrosDe("triptico-c", 50, 70, 5);
    expect(izq.w).toBeCloseTo(35, 9);
    expect(izq.y + izq.h / 2).toBeCloseTo(centro.y + centro.h / 2, 9);
    expect(der.x).toBeCloseTo(35 + 5 + 50 + 5, 9);
  });

  it("toda composición tiene al menos un cuadro y ninguno se superpone", () => {
    for (const { id } of COMPOSICIONES) {
      const cuadros = cuadrosDe(id, 40, 50, 5);
      expect(cuadros.length).toBeGreaterThan(0);
      for (let i = 0; i < cuadros.length; i++)
        for (let j = i + 1; j < cuadros.length; j++) {
          const a = cuadros[i], b = cuadros[j];
          const pisa = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(pisa, `${id}: ${i} y ${j}`).toBe(false);
        }
    }
  });
});
