import { DRAND_DEFAULT_CHAIN_HASH, DRAND_MIRRORS, DRAND_TIMEOUT_MS } from "./constants";

/**
 * El número que nadie puede predecir.
 *
 * drand es un servicio público operado en conjunto por varias organizaciones (Cloudflare,
 * EPFL, Protocol Labs y otras). Produce un valor cada pocos segundos con criptografía de
 * umbral: ninguna de ellas puede generarlo sola, ni predecirlo, ni sesgarlo. Cada valor queda
 * publicado para siempre.
 *
 * Este archivo es el único del módulo que habla con la red.
 *
 * ── Por qué dos espejos ──
 *
 * Un solo servidor que responde lo que quiere sería un punto único de confianza, y todo el
 * módulo existe para no tener uno. Se consultan dos y tienen que decir exactamente lo mismo.
 * Si sólo uno contesta, no se resuelve: es preferible que el acto espere a que el resultado
 * dependa de la palabra de un solo servidor.
 */

export type DrandChainInfo = {
  chainHash: string;
  periodSeconds: number;
  /** Segundos Unix del primer valor de la cadena. */
  genesisTimeSeconds: number;
};

export type DrandRound = {
  round: number;
  randomness: string;
  signature: string;
};

/** Cuándo sale la tanda N. La tanda 1 es la del génesis. */
export function roundTime(info: DrandChainInfo, round: number): Date {
  return new Date((info.genesisTimeSeconds + (round - 1) * info.periodSeconds) * 1000);
}

/**
 * La primera tanda ESTRICTAMENTE posterior a ese instante.
 *
 * Estrictamente posterior y no "la de ese momento": si el acto es a las 20:00 y la tanda de
 * las 20:00 ya existe cuando alguien aprieta el botón, el número dejaría de ser futuro.
 */
export function roundAfter(info: DrandChainInfo, instante: Date): number {
  const segundos = Math.floor(instante.getTime() / 1000);
  if (segundos < info.genesisTimeSeconds) {
    throw new Error("Ese momento es anterior al génesis de la cadena de drand.");
  }
  return Math.floor((segundos - info.genesisTimeSeconds) / info.periodSeconds) + 2;
}

async function leerDeEspejos<T>(ruta: string, parsear: (crudo: unknown) => T): Promise<T> {
  const resultados: { espejo: string; valor: T }[] = [];
  const fallas: string[] = [];

  for (const espejo of DRAND_MIRRORS) {
    try {
      const r = await fetch(`${espejo}${ruta}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(DRAND_TIMEOUT_MS),
      });
      // Que la tanda no exista todavía no es una falla del espejo: es la respuesta, y es la
      // misma en todos. Sale para arriba sin probar los demás.
      //
      // 425 ("Too Early") es lo que contesta drand para una tanda futura —comprobado contra
      // el servicio el 2026-09-08—; 404 queda contemplado por si algún espejo responde así.
      if (r.status === 425 || r.status === 404) throw new Error("La tanda todavía no salió.");
      if (!r.ok) {
        fallas.push(`${espejo}: HTTP ${r.status}`);
        continue;
      }
      resultados.push({ espejo, valor: parsear(await r.json()) });
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      if (detalle.includes("todavía no")) throw error;
      fallas.push(`${espejo}: ${detalle}`);
    }
    if (resultados.length === 2) break;
  }

  if (resultados.length < 2) {
    throw new Error(`No se pudo leer drand de dos espejos. ${fallas.join(" · ")}`);
  }
  const [a, b] = resultados;
  if (JSON.stringify(a.valor) !== JSON.stringify(b.valor)) {
    throw new Error(
      `Los espejos de drand no coinciden (${a.espejo} y ${b.espejo}). El sorteo no se resuelve.`,
    );
  }
  return a.valor;
}

/** Período y génesis de la cadena. Se leen del servicio, nunca se fijan en el código. */
export async function fetchChainInfo(
  chainHash: string = DRAND_DEFAULT_CHAIN_HASH,
): Promise<DrandChainInfo> {
  return leerDeEspejos(`/${chainHash}/info`, (crudo) => {
    const d = crudo as { hash?: string; period?: number; genesis_time?: number };
    if (d.hash !== chainHash) {
      throw new Error("El servicio devolvió otra cadena de la que se pidió.");
    }
    if (typeof d.period !== "number" || typeof d.genesis_time !== "number") {
      throw new Error("La respuesta de drand no trae período y génesis.");
    }
    return { chainHash, periodSeconds: d.period, genesisTimeSeconds: d.genesis_time };
  });
}

/** El valor de una tanda. Falla con "todavía no" mientras no exista. */
export async function fetchRound(chainHash: string, round: number): Promise<DrandRound> {
  return leerDeEspejos(`/${chainHash}/public/${round}`, (crudo) => {
    const d = crudo as { round?: number; randomness?: string; signature?: string };
    if (d.round !== round || !d.randomness || !d.signature) {
      throw new Error("La respuesta de drand no tiene la forma esperada.");
    }
    return { round: d.round, randomness: d.randomness, signature: d.signature };
  });
}
