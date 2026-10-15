/**
 * Cuándo un dedo que se arrastró significa "pasá a lo siguiente".
 *
 * En el visor hay dos lugares que escuchan el mismo gesto y hacen cosas
 * distintas: sobre los criterios pasa al criterio de al lado, sobre la
 * fotografía pasa a la obra de al lado. La regla de cuándo cuenta tiene que
 * ser una sola, o uno de los dos va a sentirse más pesado que el otro.
 */

/** Cuánto hay que arrastrar para que cuente como un paso, en píxeles. */
export const ARRASTRE_MINIMO = 56;

/** Un tirón corto pero rápido también cuenta: píxeles por milisegundo. */
export const VELOCIDAD_MINIMA = 0.45;

/**
 * Antes de este recorrido no se sabe si el gesto es horizontal o vertical, y
 * hasta saberlo no se le roba el dedo al teléfono.
 */
export const RECORRIDO_PARA_DECIDIR = 10;

export type Direccion = 1 | -1;

/**
 * Si el gesto ya se define como horizontal, vertical, o todavía no se sabe.
 *
 * `null` es "seguí mirando": el dedo se movió tan poco que decidir ahora
 * sería adivinar, y equivocarse significa trabar el desplazamiento vertical
 * de la página o tragarse un toque.
 */
export function esGestoHorizontal(dx: number, dy: number): boolean | null {
  if (
    Math.abs(dx) < RECORRIDO_PARA_DECIDIR &&
    Math.abs(dy) < RECORRIDO_PARA_DECIDIR
  ) {
    return null;
  }
  return Math.abs(dx) > Math.abs(dy);
}

/**
 * Hacia dónde pasar al soltar, o `null` si el gesto no alcanzó.
 *
 * Arrastrar hacia la **izquierda** trae lo que viene, como pasar una hoja:
 * por eso un `dx` negativo devuelve `1`.
 */
export function haciaDondePasar(input: {
  dx: number;
  milisegundos: number;
}): Direccion | null {
  const recorrido = Math.abs(input.dx);
  if (recorrido === 0) return null;
  const velocidad = recorrido / Math.max(1, input.milisegundos);
  if (recorrido < ARRASTRE_MINIMO && velocidad < VELOCIDAD_MINIMA) return null;
  return input.dx < 0 ? 1 : -1;
}
