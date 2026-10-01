/**
 * Formato de la sección de jurados de un concurso.
 *
 * Con seis o menos, la grilla los muestra a todos de una. Pasado ese número la
 * grilla se vuelve una pared que empuja el resto de la página hacia abajo, y
 * conviene el carrusel.
 */
export type FormatoDeSeccion = "grilla" | "carrusel";

export const TOPE_PARA_GRILLA = 6;

export function formatoDeSeccionDeJurados(cantidad: number): FormatoDeSeccion {
  return cantidad > TOPE_PARA_GRILLA ? "carrusel" : "grilla";
}
