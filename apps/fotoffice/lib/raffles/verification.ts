import { createHash } from "node:crypto";
import { drawWinners } from "./draw";

/**
 * Los datos de la prueba, y la cuenta rehecha sobre ellos.
 *
 * Módulo PURO: no consulta drand ni la base. Recibe lo que está publicado y vuelve a hacer la
 * misma cuenta que haría un tercero. Que la propia pantalla se controle a sí misma no
 * reemplaza a ese tercero —el código y la verificación salen del mismo lugar— pero muestra
 * qué tendría que dar, y detecta que alguien tocó la base a mano.
 *
 * La huella se recalcula desde la LISTA PUBLICADA, no desde la guardada. Es la comprobación
 * que importa: descubre que la lista que se le muestra al socio no es la que se selló.
 */

const ETIQUETA_PADRON = "fotoffice-raffle-v1";
const ETIQUETA_PADRON_V2 = "fotoffice-raffle-v2";

export type VerificationEntrant = {
  position: number;
  memberNumber: string;
  fullName: string;
  /** Órdenes de premio que no podía ganar por la regla de no repetir premio. */
  excludedPrizeOrders: number[];
};

export type VerificationPrize = {
  order: number;
  title: string;
  winnerPosition: number;
  winnerLabel: string;
};

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
  /** Cuándo publicó drand esa tanda. Sale de la propia cadena, no de nuestro reloj. */
  roundPublishedAt: Date;
  /** Para verlo en el servicio de origen, sin pasar por FotoOffice. */
  drandUrl: string;
  entrants: VerificationEntrant[];
  prizes: VerificationPrize[];
  /** Si algún participante quedó afuera de algún premio: define qué huella corresponde. */
  hasExclusions: boolean;
};

type SorteoParaVerificar = {
  id: string;
  title: string;
  status: string;
  entrantsHash: string | null;
  entrantsCount: number | null;
  drandChainHash: string | null;
  drandRound: number | null;
  drandRandomness: string | null;
  drandSignature: string | null;
  sealedAt: Date | null;
  drawnAt: Date | null;
  entries: {
    position: number;
    memberNumberSnapshot: string;
    fullNameSnapshot: string;
    excludedPrizeOrders?: number[];
  }[];
  prizes: { order: number; title: string; award: { winnerPosition: number } | null }[];
};

/**
 * Génesis y período de quicknet, para ubicar en el tiempo la tanda ya usada.
 *
 * Acá sí van fijos, y sólo acá: es un dato histórico de una cadena que ya produjo el valor,
 * no un parámetro del sorteo. El que se usa para SORTEAR se lee siempre del servicio.
 */
const QUICKNET_GENESIS = 1_692_803_367;
const QUICKNET_PERIOD = 3;

export function buildVerification(sorteo: SorteoParaVerificar): VerificationData | null {
  if (
    !sorteo.entrantsHash ||
    !sorteo.drandChainHash ||
    sorteo.drandRound === null ||
    !sorteo.drandRandomness ||
    !sorteo.sealedAt ||
    !sorteo.drawnAt
  ) {
    return null;
  }

  const entrants = [...sorteo.entries]
    .sort((a, b) => a.position - b.position)
    .map((e) => ({
      position: e.position,
      memberNumber: e.memberNumberSnapshot,
      fullName: e.fullNameSnapshot,
      excludedPrizeOrders: [...(e.excludedPrizeOrders ?? [])].sort((a, b) => a - b),
    }));

  const porPosicion = new Map(entrants.map((e) => [e.position, e]));

  const prizes: VerificationPrize[] = sorteo.prizes
    .filter((p): p is typeof p & { award: { winnerPosition: number } } => p.award !== null)
    .map((p) => {
      const ganador = porPosicion.get(p.award.winnerPosition);
      return {
        order: p.order,
        title: p.title,
        winnerPosition: p.award.winnerPosition,
        winnerLabel: ganador
          ? `${ganador.memberNumber} · ${ganador.fullName}`
          : `posición ${p.award.winnerPosition}`,
      };
    })
    .sort((a, b) => a.order - b.order);

  return {
    raffleId: sorteo.id,
    title: sorteo.title,
    entrantsHash: sorteo.entrantsHash,
    chainHash: sorteo.drandChainHash,
    round: sorteo.drandRound,
    randomness: sorteo.drandRandomness,
    signature: sorteo.drandSignature ?? "",
    sealedAt: sorteo.sealedAt,
    drawnAt: sorteo.drawnAt,
    roundPublishedAt: new Date(
      (QUICKNET_GENESIS + (sorteo.drandRound - 1) * QUICKNET_PERIOD) * 1000,
    ),
    drandUrl: `https://api.drand.sh/${sorteo.drandChainHash}/public/${sorteo.drandRound}`,
    entrants,
    prizes,
    hasExclusions: entrants.some((e) => e.excludedPrizeOrders.length > 0),
  };
}

/** La cuenta rehecha: la misma que haría alguien de afuera con estos datos. */
export function recheck(data: VerificationData): {
  ok: boolean;
  mismatches: string[];
  /** Premios en los que todos los que quedaban estaban excluidos y la regla cedió. */
  relaxedPrizeOrders: number[];
} {
  const mismatches: string[] = [];
  const relaxedPrizeOrders: number[] = [];

  // 1. ¿La lista publicada produce la huella publicada?
  //
  // Es la comprobación que importa: descubre que la lista que se le muestra al socio no es la
  // que se selló. Se hace con los mismos datos que están a la vista —posición y número de
  // socio—, así que cualquiera puede repetirla.
  const recalculada = hashDeNumeros(
    data.raffleId,
    data.entrants.map((e) => ({
      position: e.position,
      memberNumber: e.memberNumber,
      excludedPrizeOrders: e.excludedPrizeOrders,
    })),
  );
  if (recalculada !== data.entrantsHash) {
    mismatches.push(
      `La huella no coincide: la lista publicada da ${recalculada} y la que se selló es ${data.entrantsHash}.`,
    );
  }

  // 2. ¿Los ganadores guardados son los que sale de la cuenta?
  if (data.entrants.length > 0 && data.prizes.length > 0) {
    const recalculados = drawWinners({
      entrantsHash: data.entrantsHash,
      round: data.round,
      randomness: data.randomness,
      prizeOrders: data.prizes.map((p) => p.order),
      entrantCount: data.entrants.length,
      exclusions: new Map(data.entrants.map((e) => [e.position, e.excludedPrizeOrders])),
    });
    for (const r of recalculados) {
      if (r.ruleRelaxed) relaxedPrizeOrders.push(r.prizeOrder);
      const guardado = data.prizes.find((p) => p.order === r.prizeOrder);
      if (guardado && guardado.winnerPosition !== r.winnerPosition) {
        mismatches.push(
          `Premio ${r.prizeOrder}: la cuenta da la posición ${r.winnerPosition} y está guardada la ${guardado.winnerPosition}.`,
        );
      }
    }
  }

  return { ok: mismatches.length === 0, mismatches, relaxedPrizeOrders };
}

/**
 * La huella de una lista publicada.
 *
 * Repite deliberadamente la fórmula de `entrants.ts` en vez de importarla: si esta la tomara
 * prestada, un cambio en aquella haría que la verificación siguiera dando bien por
 * construcción, que es exactamente lo que no debe pasar. Son dos implementaciones de la misma
 * cuenta publicada, y tienen que coincidir.
 */
export function hashDeNumeros(
  raffleId: string,
  entrants: readonly { position: number; memberNumber: string; excludedPrizeOrders?: readonly number[] }[],
): string {
  // Con alguna exclusión publicada, la v2: cada línea suma de qué premios quedó afuera.
  if (entrants.some((e) => (e.excludedPrizeOrders?.length ?? 0) > 0)) {
    const cuerpo = entrants
      .map((e) => {
        const excluidos = [...(e.excludedPrizeOrders ?? [])].sort((a, b) => a - b).join(",");
        return `${e.position}:${e.memberNumber}:${excluidos}`;
      })
      .join("\n");
    return createHash("sha256")
      .update(`${ETIQUETA_PADRON_V2}\n${raffleId}\n${cuerpo}`, "utf8")
      .digest("hex");
  }
  const cuerpo = entrants.map((e) => `${e.position}:${e.memberNumber}`).join("\n");
  return createHash("sha256")
    .update(`${ETIQUETA_PADRON}\n${raffleId}\n${cuerpo}`, "utf8")
    .digest("hex");
}
