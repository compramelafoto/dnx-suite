import { createHash } from "node:crypto";
import { drawWinners } from "./draw";

/**
 * Los datos de la prueba, y la cuenta rehecha sobre ellos. Módulo PURO.
 *
 * La huella se recalcula desde la LISTA PUBLICADA: descubre que la lista que se muestra no es
 * la que se cerró. Repite a propósito la fórmula de `padron.ts` en vez de importarla: si la
 * tomara prestada, un cambio allá haría que esto diera bien por construcción.
 */

const ETIQUETA_PADRON = "clf-raffle-v1";

/** quicknet: dato histórico de la cadena, sólo para ubicar en el tiempo la tanda usada. */
const QUICKNET_GENESIS = 1_692_803_367;
const QUICKNET_PERIOD = 3;

export type VerificationData = {
  raffleId: string;
  title: string;
  entrantsHash: string;
  chainHash: string;
  round: number;
  randomness: string;
  signature: string;
  sealedAt: Date;
  drawnAt: Date;
  roundPublishedAt: Date;
  drandUrl: string;
  entrants: { position: number; code: string; displayName: string }[];
  prizes: { order: number; title: string; winnerPosition: number; winnerLabel: string }[];
};

type SorteoParaVerificar = {
  id: string;
  title: string;
  entrantsHash: string | null;
  drandChainHash: string | null;
  drandRound: number | null;
  drandRandomness: string | null;
  drandSignature: string | null;
  sealedAt: Date | null;
  drawnAt: Date | null;
  entries: { position: number; codeSnapshot: string; displayNameSnapshot: string }[];
  prizes: { order: number; title: string; award: { winnerPosition: number } | null }[];
};

export function buildVerification(s: SorteoParaVerificar): VerificationData | null {
  if (
    !s.entrantsHash ||
    !s.drandChainHash ||
    s.drandRound === null ||
    !s.drandRandomness ||
    !s.sealedAt ||
    !s.drawnAt
  ) {
    return null;
  }
  const entrants = [...s.entries]
    .sort((a, b) => a.position - b.position)
    .map((e) => ({ position: e.position, code: e.codeSnapshot, displayName: e.displayNameSnapshot }));
  const porPosicion = new Map(entrants.map((e) => [e.position, e]));
  const prizes = s.prizes
    .filter((p): p is typeof p & { award: { winnerPosition: number } } => p.award !== null)
    .map((p) => {
      const g = porPosicion.get(p.award.winnerPosition);
      return {
        order: p.order,
        title: p.title,
        winnerPosition: p.award.winnerPosition,
        winnerLabel: g ? `N.º ${g.code} · ${g.displayName}` : `posición ${p.award.winnerPosition}`,
      };
    })
    .sort((a, b) => a.order - b.order);

  return {
    raffleId: s.id,
    title: s.title,
    entrantsHash: s.entrantsHash,
    chainHash: s.drandChainHash,
    round: s.drandRound,
    randomness: s.drandRandomness,
    signature: s.drandSignature ?? "",
    sealedAt: s.sealedAt,
    drawnAt: s.drawnAt,
    roundPublishedAt: new Date((QUICKNET_GENESIS + (s.drandRound - 1) * QUICKNET_PERIOD) * 1000),
    drandUrl: `https://api.drand.sh/${s.drandChainHash}/public/${s.drandRound}`,
    entrants,
    prizes,
  };
}

export function hashDeCodigos(
  raffleId: string,
  entrants: readonly { position: number; code: string }[],
): string {
  const cuerpo = entrants.map((e) => `${e.position}:${e.code}`).join("\n");
  return createHash("sha256")
    .update(`${ETIQUETA_PADRON}\n${raffleId}\n${cuerpo}`, "utf8")
    .digest("hex");
}

/** La cuenta rehecha: la misma que haría alguien de afuera con estos datos. */
export function recheck(data: VerificationData): { ok: boolean; mismatches: string[] } {
  const mismatches: string[] = [];
  const recalculada = hashDeCodigos(data.raffleId, data.entrants);
  if (recalculada !== data.entrantsHash) {
    mismatches.push(
      `La huella no coincide: la lista publicada da ${recalculada} y la que se cerró es ${data.entrantsHash}.`,
    );
  }
  if (data.entrants.length > 0 && data.prizes.length > 0) {
    const recalculados = drawWinners({
      entrantsHash: data.entrantsHash,
      round: data.round,
      randomness: data.randomness,
      prizeOrders: data.prizes.map((p) => p.order),
      entrantCount: data.entrants.length,
    });
    for (const r of recalculados) {
      const guardado = data.prizes.find((p) => p.order === r.prizeOrder);
      if (guardado && guardado.winnerPosition !== r.winnerPosition) {
        mismatches.push(
          `Premio ${r.prizeOrder}: la cuenta da la posición ${r.winnerPosition} y está guardada la ${guardado.winnerPosition}.`,
        );
      }
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}
