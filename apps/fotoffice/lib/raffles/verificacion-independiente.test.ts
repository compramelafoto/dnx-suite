import { describe, expect, it } from "vitest";
import { drawWinners } from "./draw";
import { entrantsHash, orderEntrants } from "./entrants";

/**
 * La prueba que sostiene todo el módulo.
 *
 * Estos valores NO salieron de este código. Se calcularon aparte, el 2026-09-08, con un
 * script de veinte líneas escrito desde el pseudocódigo publicado en la pantalla de
 * verificación, usando SÓLO lo que se publica —posición y número de socio— y un número REAL
 * de drand: la tanda 32.000.000 de quicknet, leída del espejo de Cloudflare.
 *
 * Que este test siga pasando significa que un tercero, con los cuatro datos publicados y sin
 * usar FotoOffice, llega exactamente al mismo ganador. Si algún día falla, no hay que
 * "arreglar el test": significa que se cambió la cuenta y que la verificación de todos los
 * sorteos ya hechos dejó de dar.
 */

const RAFFLE_ID = "sorteo-de-prueba";
const SOCIOS = Array.from({ length: 110 }, (_, i) => ({
  memberId: `m-${String(i).padStart(3, "0")}`,
  memberNumber: String(100 + i),
  fullName: `Socio ${100 + i}`,
}));

// Calculado afuera, no acá.
const HUELLA_ESPERADA = "492d781a2f9853b1bd8d074ff012793149ed9542e0a3353f6b507d3cb1ec3e2d";
const TANDA = 32_000_000;
const NUMERO = "ea1bdeb86e62a543551740bf792d78a296861de06a8bbd64b2b0e2134f40b166";
const GANADORES_ESPERADOS = [
  { prizeOrder: 1, winnerPosition: 59 },
  { prizeOrder: 2, winnerPosition: 54 },
  { prizeOrder: 3, winnerPosition: 9 },
];

describe("un tercero llega al mismo resultado sin usar FotoOffice", () => {
  it("la huella del padrón coincide con la calculada afuera", () => {
    expect(entrantsHash(RAFFLE_ID, orderEntrants(SOCIOS))).toBe(HUELLA_ESPERADA);
  });

  it("los ganadores coinciden con los calculados afuera, con un número real de drand", () => {
    const r = drawWinners({
      entrantsHash: HUELLA_ESPERADA,
      round: TANDA,
      randomness: NUMERO,
      prizeOrders: [1, 2, 3],
      entrantCount: SOCIOS.length,
    });
    expect(r.map(({ prizeOrder, winnerPosition }) => ({ prizeOrder, winnerPosition }))).toEqual(
      GANADORES_ESPERADOS,
    );
  });

  it("el socio que gana el primer premio es el 159", () => {
    const padron = orderEntrants(SOCIOS);
    const r = drawWinners({
      entrantsHash: HUELLA_ESPERADA,
      round: TANDA,
      randomness: NUMERO,
      prizeOrders: [1],
      entrantCount: padron.length,
    });
    expect(padron[r[0].winnerPosition].memberNumber).toBe("159");
  });
});

/**
 * Lo mismo, con la regla de no repetir premio (huella v2).
 *
 * Valores calculados el 2026-10-12 con un script en Python escrito desde el pseudocódigo v2 de
 * la pantalla de verificación, sin usar FotoOffice. Las exclusiones están elegidas para que la
 * regla se note: el 159 y el 154 —que en la prueba de arriba ganan el premio 1 y el 2— quedan
 * afuera justo de esos premios, y el 109 de dos premios a la vez. Si falla, no se arregla el
 * test: se cambió la cuenta.
 */
describe("un tercero llega al mismo resultado con exclusiones (v2)", () => {
  const EXCLUSIONES: Record<number, number[]> = { 59: [1], 54: [2], 9: [3, 1], 0: [2] };
  const HUELLA_V2 = "39c57cfd4d203fca90cb9910ce8f3d4b763f02c57075aee59acad7b00e38029c";
  const padron = orderEntrants(SOCIOS).map((e) => ({
    ...e,
    excludedPrizeOrders: EXCLUSIONES[e.position] ?? [],
  }));

  it("la huella v2 coincide con la calculada afuera", () => {
    expect(entrantsHash(RAFFLE_ID, padron)).toBe(HUELLA_V2);
  });

  it("los ganadores coinciden con los calculados afuera", () => {
    const r = drawWinners({
      entrantsHash: HUELLA_V2,
      round: TANDA,
      randomness: NUMERO,
      prizeOrders: [1, 2, 3],
      entrantCount: padron.length,
      exclusions: new Map(padron.map((e) => [e.position, e.excludedPrizeOrders])),
    });
    expect(r.map((x) => padron[x.winnerPosition].memberNumber)).toEqual(["162", "179", "153"]);
  });
});

