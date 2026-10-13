import { describe, expect, it } from "vitest";
import { drawWinners } from "./draw";

const base = {
  entrantsHash: "a".repeat(64),
  round: 1_234_567,
  randomness: "b".repeat(64),
};

describe("la extracción", () => {
  it("saca un ganador por premio", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 50 });
    expect(r).toHaveLength(3);
    expect(r.map((x) => x.prizeOrder)).toEqual([1, 2, 3]);
  });

  it("nadie se lleva dos premios del mismo sorteo", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3, 4, 5], entrantCount: 6 });
    const ganadores = r.map((x) => x.winnerPosition);
    expect(new Set(ganadores).size).toBe(ganadores.length);
  });

  it("las posiciones que devuelve están dentro del padrón", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 110 });
    for (const x of r) {
      expect(x.winnerPosition).toBeGreaterThanOrEqual(0);
      expect(x.winnerPosition).toBeLessThan(110);
    }
  });

  it("es determinística: los mismos datos dan siempre el mismo resultado", () => {
    const a = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    const b = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    expect(b).toEqual(a);
  });

  it("cambia si cambia el número de drand", () => {
    const a = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    const b = drawWinners({ ...base, randomness: "c".repeat(64), prizeOrders: [1], entrantCount: 110 });
    expect(b[0].winnerPosition).not.toBe(a[0].winnerPosition);
  });

  it("cambia si cambia el padrón", () => {
    const a = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    const b = drawWinners({ ...base, entrantsHash: "d".repeat(64), prizeOrders: [1], entrantCount: 110 });
    expect(b[0].winnerPosition).not.toBe(a[0].winnerPosition);
  });

  it("el orden del premio importa: el primero y el segundo no salen del mismo cálculo", () => {
    const r = drawWinners({ ...base, prizeOrders: [1, 2], entrantCount: 110 });
    expect(r[0].winnerPosition).not.toBe(r[1].winnerPosition);
  });

  it("con un solo participante, gana ese", () => {
    const r = drawWinners({ ...base, prizeOrders: [1], entrantCount: 1 });
    expect(r[0].winnerPosition).toBe(0);
  });

  it("no se puede sortear más premios que participantes", () => {
    expect(() => drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 2 })).toThrow(
      /participantes/i,
    );
  });

  it("no se puede sortear sin participantes", () => {
    expect(() => drawWinners({ ...base, prizeOrders: [1], entrantCount: 0 })).toThrow(
      /participantes/i,
    );
  });

  it("reparte parejo: con 3 en la bolsa y muchos números distintos, ninguna posición se lleva todo", () => {
    const cuenta = new Map<number, number>();
    for (let n = 0; n < 300; n++) {
      const r = drawWinners({
        ...base,
        randomness: n.toString(16).padStart(64, "0"),
        prizeOrders: [1],
        entrantCount: 3,
      });
      const p = r[0].winnerPosition;
      cuenta.set(p, (cuenta.get(p) ?? 0) + 1);
    }
    expect(cuenta.size).toBe(3);
    for (const veces of cuenta.values()) {
      expect(veces).toBeGreaterThan(50);
      expect(veces).toBeLessThan(200);
    }
  });

  it("informa cuántas vueltas necesitó: es lo que prueba que el descarte por sesgo funciona", () => {
    const r = drawWinners({ ...base, prizeOrders: [1], entrantCount: 110 });
    expect(r[0].iterations).toBeGreaterThanOrEqual(0);
  });
});

describe("la extracción con premios que alguien no puede repetir", () => {
  it("sin exclusiones da exactamente lo mismo que antes", () => {
    const antes = drawWinners({ ...base, prizeOrders: [1, 2, 3], entrantCount: 30 });
    const ahora = drawWinners({
      ...base,
      prizeOrders: [1, 2, 3],
      entrantCount: 30,
      exclusions: new Map(),
    });
    expect(ahora).toEqual(antes);
  });

  it("quien está excluido de un premio no lo gana nunca", () => {
    for (let k = 0; k < 200; k++) {
      const r = drawWinners({
        ...base,
        randomness: k.toString(16).padStart(64, "0"),
        prizeOrders: [1, 2],
        entrantCount: 4,
        exclusions: new Map([
          [0, [1]],
          [1, [1]],
        ]),
      });
      expect([0, 1]).not.toContain(r[0].winnerPosition);
    }
  });

  it("el excluido de un premio sí puede ganar otro", () => {
    const ganados = new Set<number>();
    for (let k = 0; k < 200; k++) {
      const r = drawWinners({
        ...base,
        randomness: k.toString(16).padStart(64, "0"),
        prizeOrders: [1, 2],
        entrantCount: 3,
        exclusions: new Map([[0, [1]]]),
      });
      ganados.add(r[1].winnerPosition);
    }
    expect(ganados.has(0)).toBe(true);
  });

  it("si para un premio no queda nadie habilitado, se sortea entre todos los que quedan y lo informa", () => {
    const r = drawWinners({
      ...base,
      prizeOrders: [1],
      entrantCount: 2,
      exclusions: new Map([
        [0, [1]],
        [1, [1]],
      ]),
    });
    expect(r[0].ruleRelaxed).toBe(true);
    expect([0, 1]).toContain(r[0].winnerPosition);
  });

  it("cuando la regla no cede, lo dice", () => {
    const r = drawWinners({
      ...base,
      prizeOrders: [1],
      entrantCount: 3,
      exclusions: new Map([[0, [1]]]),
    });
    expect(r[0].ruleRelaxed).toBe(false);
  });
});
