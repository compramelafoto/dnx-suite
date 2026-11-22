import { createHash } from "node:crypto";

/**
 * El padrón: quién participa, en qué orden y con qué huella.
 *
 * Módulo PURO. La huella se publica antes de que exista el número de drand: es la mitad de la
 * prueba de que el sorteo no se arregló, así que cualquiera tiene que poder recalcularla con
 * la lista publicada.
 *
 * Cada fotógrafo figura con su número de cuenta (`code`, el id del usuario como texto). Es lo
 * que entra en la huella; el nombre no, para que corregir una tilde no invalide la prueba.
 */

export type EntrantInput = {
  userId: number;
  displayName: string;
  salesCount: number;
};

export type Entrant = EntrantInput & {
  code: string;
  /** Posición en la bolsa, desde 0. */
  position: number;
};

/** Etiqueta literal y para siempre. Un formato nuevo sería `-v2`, nunca editar esta. */
const ETIQUETA = "clf-raffle-v1";

/** Por número de cuenta ascendente: el orden no puede depender de cómo devuelva Postgres. */
export function orderEntrants(input: readonly EntrantInput[]): Entrant[] {
  const unicos = new Map<number, EntrantInput>();
  for (const e of input) if (!unicos.has(e.userId)) unicos.set(e.userId, e);
  return [...unicos.values()]
    .sort((a, b) => a.userId - b.userId)
    .map((e, position) => ({ ...e, code: String(e.userId), position }));
}

export function entrantsHash(
  raffleId: string,
  entrants: readonly { position: number; code: string }[],
): string {
  const cuerpo = entrants.map((e) => `${e.position}:${e.code}`).join("\n");
  return createHash("sha256").update(`${ETIQUETA}\n${raffleId}\n${cuerpo}`, "utf8").digest("hex");
}

/**
 * Cómo se lo nombra en la lista pública: nombre e inicial del apellido, o el estudio.
 * Que vendió en el mes es un dato de su negocio: no se publica el nombre completo.
 */
export function publicName(input: { name?: string | null; companyName?: string | null }): string {
  const estudio = (input.companyName ?? "").trim();
  const nombre = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (nombre) {
    const partes = nombre.split(" ");
    if (partes.length === 1) return partes[0];
    const inicial = partes[partes.length - 1].charAt(0).toUpperCase();
    return `${partes.slice(0, -1).join(" ")} ${inicial}.`;
  }
  if (estudio) return estudio;
  return "Fotógrafo";
}
