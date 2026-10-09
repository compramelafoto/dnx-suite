/**
 * Qué le toca a la pantalla del salón en cada vuelta: una foto o el código QR.
 *
 * El QR no puede estar fijo en una esquina —en un televisor a tres metros, chico y
 * encima de una foto, no lo escanea nadie— ni aparecer una sola vez al principio, porque
 * la gente llega durante toda la noche. Entonces se intercala: cada diez fotos, la
 * pantalla entera es el código.
 *
 * El caso que más importa es el de **cero fotos**: el salón llegando y nadie subió nada
 * todavía. Ahí la pantalla es el QR todo el tiempo, que es exactamente lo que hace falta
 * para que el evento arranque.
 */

/** Cada cuántas fotos se intercala el código. */
export const CADA_CUANTAS_FOTOS_EL_QR = 10;

/** El ciclo completo: diez fotos y el código. */
const LARGO_DEL_CICLO = CADA_CUANTAS_FOTOS_EL_QR + 1;

export type PasoDePantalla =
  | { tipo: "FOTO"; indice: number }
  | { tipo: "QR" };

export function queMostrar({
  vuelta,
  cantidadDeFotos,
}: {
  /** Cuenta hacia arriba sin tope; el resto sale con módulo. */
  vuelta: number;
  cantidadDeFotos: number;
}): PasoDePantalla {
  if (cantidadDeFotos <= 0) return { tipo: "QR" };

  const posicionEnElCiclo = vuelta % LARGO_DEL_CICLO;
  if (posicionEnElCiclo === CADA_CUANTAS_FOTOS_EL_QR) return { tipo: "QR" };

  /*
    Cuántas fotos se mostraron antes de ésta, salteando los turnos del QR. Se cuenta así
    y no con `vuelta % cantidadDeFotos` para que la rotación no se saltee fotos cada vez
    que pasa un QR: con cuatro fotos y módulo directo, la cuarta no se vería nunca.
  */
  const ciclosCompletos = Math.floor(vuelta / LARGO_DEL_CICLO);
  const fotosMostradas = ciclosCompletos * CADA_CUANTAS_FOTOS_EL_QR + posicionEnElCiclo;

  return { tipo: "FOTO", indice: fotosMostradas % cantidadDeFotos };
}
