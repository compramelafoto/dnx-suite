import { describe, expect, it } from "vitest";
import { buildVerification, recheck, type VerificationData } from "./verification";
import { drawWinners } from "./draw";
import { entrantsHash, orderEntrants } from "./entrants";

const SOCIOS = Array.from({ length: 40 }, (_, i) => ({
  memberId: `m-${String(i).padStart(3, "0")}`,
  memberNumber: String(100 + i),
  fullName: `Socio ${100 + i}`,
}));
const PADRON = orderEntrants(SOCIOS);
const HUELLA = entrantsHash("r-1", PADRON);
const TANDA = 32_000_000;
const NUMERO = "ea1bdeb86e62a543551740bf792d78a296861de06a8bbd64b2b0e2134f40b166";
const GANADORES = drawWinners({
  entrantsHash: HUELLA,
  round: TANDA,
  randomness: NUMERO,
  prizeOrders: [1, 2],
  entrantCount: PADRON.length,
});

const sorteoResuelto = {
  id: "r-1",
  title: "Sorteo de septiembre",
  status: "SORTEADO",
  entrantsHash: HUELLA,
  entrantsCount: PADRON.length,
  drandChainHash: "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971",
  drandRound: TANDA,
  drandRandomness: NUMERO,
  drandSignature: "b".repeat(96),
  sealedAt: new Date("2026-09-29T23:05:00Z"),
  drawnAt: new Date("2026-09-30T23:05:00Z"),
  entries: PADRON.map((e) => ({
    position: e.position,
    memberNumberSnapshot: e.memberNumber,
    fullNameSnapshot: e.fullName,
  })),
  prizes: GANADORES.map((g, i) => ({
    order: g.prizeOrder,
    title: `Premio ${i + 1}`,
    award: { winnerPosition: g.winnerPosition },
  })),
};

const datos = () => buildVerification(sorteoResuelto) as VerificationData;

describe("armar la verificación", () => {
  it("un sorteo que todavía no se resolvió no tiene qué verificar", () => {
    expect(buildVerification({ ...sorteoResuelto, drandRandomness: null })).toBe(null);
    expect(buildVerification({ ...sorteoResuelto, entrantsHash: null })).toBe(null);
  });

  it("publica la lista completa de participantes con su posición", () => {
    const d = datos();
    expect(d.entrants).toHaveLength(40);
    expect(d.entrants[0]).toMatchObject({ position: 0, memberNumber: "100" });
  });

  it("el enlace apunta a la tanda concreta en el servicio de origen", () => {
    expect(datos().drandUrl).toBe(
      `https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/public/${TANDA}`,
    );
  });

  it("dice cuándo se publicó el número, calculado de la propia cadena", () => {
    expect(datos().roundPublishedAt).toBeInstanceOf(Date);
  });
});

describe("rehacer la cuenta", () => {
  it("un sorteo bien resuelto verifica", () => {
    expect(recheck(datos())).toEqual({ ok: true, mismatches: [] });
  });

  it("si alguien cambió un ganador en la base, se detecta y se nombra", () => {
    const d = datos();
    const roto = {
      ...d,
      prizes: [{ ...d.prizes[0], winnerPosition: d.prizes[0].winnerPosition + 1 }, d.prizes[1]],
    };
    const r = recheck(roto);
    expect(r.ok).toBe(false);
    expect(r.mismatches[0]).toContain("Premio");
  });

  it("si la lista publicada no produce la huella guardada, se detecta", () => {
    const d = datos();
    const roto = { ...d, entrants: d.entrants.slice(0, 39) };
    const r = recheck(roto);
    expect(r.ok).toBe(false);
    expect(r.mismatches.some((m) => /huella/i.test(m))).toBe(true);
  });

  it("si cambia el número guardado, los ganadores dejan de dar", () => {
    const r = recheck({ ...datos(), randomness: "f".repeat(64) });
    expect(r.ok).toBe(false);
  });

  it("cambiar el orden de la lista publicada también se detecta", () => {
    const d = datos();
    const invertida = [...d.entrants].reverse().map((e, i) => ({ ...e, position: i }));
    expect(recheck({ ...d, entrants: invertida }).ok).toBe(false);
  });
});
