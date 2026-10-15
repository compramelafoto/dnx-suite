/**
 * El orden y el avance del carrusel de testimonios.
 *
 * El orden se baraja en cada visita para que no siempre se luzcan los mismos
 * tres: con ocho publicados y tres a la vista, el que quedó último nunca se
 * leería.
 */

/**
 * Fisher-Yates con el azar inyectado, para poder probarlo.
 * Devuelve una copia: la lista que entra no se toca.
 */
export function shuffleForDisplay<T>(
  items: readonly T[],
  random: () => number,
): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** Avanza de a uno y vuelve al principio al llegar al final. */
export function nextSlideIndex(current: number, total: number): number {
  if (total <= 1) return 0;
  return (current + 1) % total;
}

/** Cada cuánto pasa solo. Suficiente para leer un testimonio completo. */
export const AUTOPLAY_MS = 9000;
