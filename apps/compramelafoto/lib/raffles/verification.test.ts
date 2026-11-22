import { describe, expect, it } from "vitest";
import { drawWinners } from "./draw";
import { entrantsHash, orderEntrants } from "./padron";
import { buildVerification, recheck } from "./verification";

function sorteoResuelto() {
  const lista = orderEntrants(
    [5, 9, 14, 22, 31].map((userId) => ({ userId, displayName: `F${userId}`, salesCount: 1 })),
  );
  const hash = entrantsHash("raf1", lista);
  const randomness = "ab".repeat(32);
  const [g] = drawWinners({ entrantsHash: hash, round: 100, randomness, prizeOrders: [1], entrantCount: lista.length });
  return {
    id: "raf1",
    title: "Prueba",
    entrantsHash: hash,
    drandChainHash: "c".repeat(64),
    drandRound: 100,
    drandRandomness: randomness,
    drandSignature: "s",
    sealedAt: new Date(),
    drawnAt: new Date(),
    entries: lista.map((e) => ({ position: e.position, codeSnapshot: e.code, displayNameSnapshot: e.displayName })),
    prizes: [{ order: 1, title: "Premio", award: { winnerPosition: g.winnerPosition } }],
  };
}

describe("la verificación", () => {
  it("un sorteo bien hecho verifica", () => {
    const v = buildVerification(sorteoResuelto())!;
    expect(recheck(v).ok).toBe(true);
    expect(v.drandUrl).toContain("/public/100");
  });

  it("detecta una lista publicada que no es la que se cerró", () => {
    const s = sorteoResuelto();
    s.entries[2] = { ...s.entries[2], codeSnapshot: "999" };
    expect(recheck(buildVerification(s)!).ok).toBe(false);
  });

  it("detecta un ganador cambiado a mano", () => {
    const s = sorteoResuelto();
    s.prizes[0].award.winnerPosition = (s.prizes[0].award.winnerPosition + 1) % 5;
    const r = recheck(buildVerification(s)!);
    expect(r.ok).toBe(false);
    expect(r.mismatches[0]).toContain("Premio 1");
  });

  it("sin sortear todavía no hay verificación", () => {
    expect(buildVerification({ ...sorteoResuelto(), drawnAt: null })).toBeNull();
  });
});
