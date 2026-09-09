import { createHash } from "node:crypto";

/**
 * El padrón congelado: quién participa, en qué orden y con qué huella.
 *
 * Módulo PURO: sin base y sin red. Es la mitad de la prueba de que el sorteo no se arregló,
 * así que tiene que poder recalcularse en cualquier lado —incluso fuera de FotoOffice— con
 * sólo la lista de participantes publicada.
 */

export type EntrantInput = {
  memberId: string;
  memberNumber: string;
  fullName: string;
};

export type Entrant = EntrantInput & {
  /** Posición en la bolsa, desde 0. Es lo que la extracción devuelve. */
  position: number;
};

/**
 * Etiqueta de dominio de la huella. Literal y para siempre.
 *
 * Sirve para que esta huella no pueda confundirse con ninguna otra de la aplicación, y para
 * poder cambiar el formato en el futuro sin invalidar lo ya publicado: eso sería `-v2`, una
 * función nueva al lado de esta, nunca una edición de esta línea.
 */
const ETIQUETA = "fotoffice-raffle-v1";

/**
 * Ordena el padrón de manera determinística.
 *
 * Por número de socio ascendente, tratado como número: la base devuelve `memberNumber` como
 * texto y "10" ordenado como texto va antes que "9". Los que no son números —honorarios con
 * "H-1", por ejemplo— van al final, ordenados entre ellos por texto. El id desempata, aunque
 * no pueda haber empate: el orden no puede depender de cómo Postgres devuelva las filas.
 */
export function orderEntrants(input: readonly EntrantInput[]): Entrant[] {
  const clave = (e: EntrantInput) => {
    const n = Number(e.memberNumber);
    return Number.isFinite(n) && e.memberNumber.trim() !== "" ? n : null;
  };

  return [...input]
    .sort((a, b) => {
      const na = clave(a);
      const nb = clave(b);
      if (na !== null && nb !== null && na !== nb) return na - nb;
      if (na !== null && nb === null) return -1;
      if (na === null && nb !== null) return 1;
      if (na === null && nb === null && a.memberNumber !== b.memberNumber) {
        return a.memberNumber < b.memberNumber ? -1 : 1;
      }
      return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
    })
    .map((e, position) => ({ ...e, position }));
}

/**
 * La huella del padrón: SHA-256 sobre las posiciones y los números de socio.
 *
 * Se publica ANTES de que exista el número de drand. Es lo que impide acomodar la lista
 * sabiendo el resultado.
 *
 * ── Por qué el número de socio y no el id interno ──
 *
 * La primera versión usaba `memberId` —un identificador interno— por prudencia con los datos
 * personales. Estaba mal, y se vio al escribir la pantalla de verificación: los ids no se
 * publican, así que un tercero no podía recalcular la huella con lo que tiene a la vista, y
 * una prueba que sólo la institución puede rehacer no prueba nada. El número de socio, en
 * cambio, ya está en la lista publicada, está en el carnet, y no cambia nunca: es la
 * identidad del socio dentro de la institución, no un dato que se corrija.
 *
 * El NOMBRE sigue afuera a propósito: se publica para que la lista se pueda leer, pero puede
 * corregirse —una tilde, un apellido mal cargado— y una corrección de tipeo no puede
 * invalidar la prueba de un sorteo.
 */
export function entrantsHash(raffleId: string, entrants: readonly Entrant[]): string {
  const cuerpo = entrants.map((e) => `${e.position}:${e.memberNumber}`).join("\n");
  return createHash("sha256").update(`${ETIQUETA}\n${raffleId}\n${cuerpo}`, "utf8").digest("hex");
}
