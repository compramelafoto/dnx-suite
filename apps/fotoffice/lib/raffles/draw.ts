import { createHash } from "node:crypto";

/**
 * La extracción: de la huella del padrón y el número de drand a los ganadores.
 *
 * Módulo PURO. No sabe de socios ni de premios: recibe cuántos participan y qué premios hay,
 * y devuelve posiciones. Quién ocupa cada posición lo resuelve el padrón sellado.
 *
 * Que sea puro es parte del diseño: cualquiera puede reimplementar estas veinte líneas en
 * otro lenguaje y llegar al mismo resultado con los cuatro datos publicados. Esa es la
 * garantía; el resto de la aplicación no participa de ella.
 */

const ETIQUETA = "fotoffice-raffle-draw-v1";

/** 2^64. El espacio de los enteros que salen de los primeros 8 bytes del digest. */
const DOS_A_LA_64 = 1n << 64n;

export type DrawInput = {
  /** La huella publicada antes de que existiera el número. */
  entrantsHash: string;
  /** Tanda de drand fijada al anunciar. */
  round: number;
  /** El valor que devolvió drand para esa tanda, en hexadecimal. */
  randomness: string;
  /** Los premios, por su `order`. Se recorren en el orden en que vienen. */
  prizeOrders: readonly number[];
  entrantCount: number;
  /**
   * De qué premios quedó afuera cada posición, por la regla de no repetir premio. Se congeló
   * al sellar el padrón y está en la huella. Sin exclusiones, la cuenta es la de siempre.
   */
  exclusions?: ReadonlyMap<number, readonly number[]>;
};

export type DrawResult = {
  prizeOrder: number;
  /** Posición en el padrón ordenado, desde 0. */
  winnerPosition: number;
  /** Cuántos descartes hicieron falta. En la práctica, cero. */
  iterations: number;
  /**
   * Todos los que quedaban en la bolsa estaban excluidos de este premio, así que se sorteó
   * entre todos ellos: la regla cede antes que dejar el premio sin sortear.
   */
  ruleRelaxed: boolean;
};

/** Un entero de 64 bits sin signo a partir de los primeros 8 bytes del SHA-256. */
function enteroDe64Bits(...partes: (string | number)[]): (i: number) => bigint {
  return (i: number) => {
    const digest = createHash("sha256")
      .update([ETIQUETA, ...partes, i].join("\n"), "utf8")
      .digest();
    return digest.readBigUInt64BE(0);
  };
}

/**
 * Sortea todos los premios, sacando de la bolsa a quien ya ganó.
 *
 * El descarte de los valores por encima de `limite` elimina el sesgo del módulo. Sin él las
 * primeras posiciones tendrían una probabilidad mayor: con 110 socios el desvío es del orden
 * de 10⁻¹⁷ y nadie lo notaría jamás, pero un sorteo que se ofrece como verificable no puede
 * tener un sesgo conocido, por chico que sea. El costo es un bucle que casi nunca itera.
 */
export function drawWinners(input: DrawInput): DrawResult[] {
  const { entrantsHash, round, randomness, prizeOrders, entrantCount, exclusions } = input;

  if (entrantCount <= 0) {
    throw new Error("No hay participantes: no se puede sortear.");
  }
  if (prizeOrders.length > entrantCount) {
    throw new Error(
      `Hay ${prizeOrders.length} premios y ${entrantCount} participantes: no alcanzan los participantes.`,
    );
  }

  const bolsa: number[] = Array.from({ length: entrantCount }, (_, i) => i);
  const resultados: DrawResult[] = [];

  for (const prizeOrder of prizeOrders) {
    const valor = enteroDe64Bits(entrantsHash, round, randomness, prizeOrder);
    // La bolsa de ESTE premio: los que no ganaron todavía, menos los excluidos de él, en el
    // mismo orden ascendente. Si no queda nadie, la regla cede y entran todos.
    const habilitados = bolsa.filter((pos) => !(exclusions?.get(pos) ?? []).includes(prizeOrder));
    const ruleRelaxed = habilitados.length === 0;
    const urna = ruleRelaxed ? bolsa : habilitados;
    const n = BigInt(urna.length);
    const limite = (DOS_A_LA_64 / n) * n;

    let i = 0;
    for (;;) {
      const x = valor(i);
      if (x < limite) {
        const indice = Number(x % n);
        const winnerPosition = urna[indice];
        resultados.push({ prizeOrder, winnerPosition, iterations: i, ruleRelaxed });
        bolsa.splice(bolsa.indexOf(winnerPosition), 1);
        break;
      }
      i += 1;
    }
  }

  return resultados;
}
