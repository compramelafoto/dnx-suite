import { describe, expect, it } from "vitest";
import { drawWinners } from "./draw";
import { entrantsHash, orderEntrants } from "./entrants";

/**
 * La prueba que sostiene todo el módulo.
 *
 * Estos valores NO salieron de este código. Se calcularon aparte, el 2026-09-08, con un
 * script de veinte líneas escrito desde el pseudocódigo publicado en la pantalla de
 * verificación, y con un número REAL de drand —la tanda 32.000.000 de quicknet, leída del
 * espejo de Cloudflare—.
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
const HUELLA_ESPERADA = "f6093a33c89e616e2512b8c29cd70d11fd669c2ea50d5c59cb2f132471979f4d";
const TANDA = 32_000_000;
const NUMERO = "ea1bdeb86e62a543551740bf792d78a296861de06a8bbd64b2b0e2134f40b166";
const GANADORES_ESPERADOS = [
  { prizeOrder: 1, winnerPosition: 83 },
  { prizeOrder: 2, winnerPosition: 77 },
  { prizeOrder: 3, winnerPosition: 100 },
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

  it("el socio que gana el primer premio es el 183", () => {
    const padron = orderEntrants(SOCIOS);
    const r = drawWinners({
      entrantsHash: HUELLA_ESPERADA,
      round: TANDA,
      randomness: NUMERO,
      prizeOrders: [1],
      entrantCount: padron.length,
    });
    expect(padron[r[0].winnerPosition].memberNumber).toBe("183");
  });
});
