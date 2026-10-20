/**
 * Cuánto hace que el control en vivo volvió a mirar la base.
 *
 * `/panel/eventos/[id]/control` es un componente de servidor con `revalidate = 0` y un
 * comentario que decía "se recarga sola". No se recargaba: `revalidate = 0` evita que la
 * respuesta quede en caché, pero nada volvía a pedirla. La página mostraba la foto de un
 * instante —el de cuando se abrió— para toda la noche.
 *
 * Desde que no hay cola de revisión manual, sacar algo de ahí es la **única** forma de
 * frenar lo que no corresponde. Una lista congelada no frena nada, y lo peor es que se ve
 * igual que una lista al día: a oscuras, con música, nadie nota la diferencia.
 *
 * De ahí el cartel con la hora. Es lo único que distingue "no subió nadie" de "esto está
 * colgado", y es la diferencia entre confiar en la pantalla y revisar el teléfono cada dos
 * minutos por si acaso.
 */

/**
 * Ocho segundos.
 *
 * Más seguido pelea con el dedo: la lista está ordenada por lo último que llegó, así que
 * cada actualización corre las fotos de lugar, y acá un toque saca algo de la pared sin
 * preguntar. Más espaciado deja pasar demasiado tiempo con algo proyectado.
 */
export const ESPERA_ENTRE_MIRADAS_MS = 8_000;

/** Pasado este rato ya no es "recién": es una falla y tiene que leerse como tal. */
const SE_COLGO_MS = 10 * 60_000;

export function textoDeFrescura(msDesdeLaUltima: number): string {
  const ms = Math.max(0, msDesdeLaUltima);

  if (ms >= SE_COLGO_MS) {
    return `${Math.floor(ms / 60_000)} min sin actualizar`;
  }
  // Por debajo de una mirada y media no vale la pena mostrar un número que parpadea.
  if (ms < ESPERA_ENTRE_MIRADAS_MS - 3_000) return "al día";
  if (ms < 60_000) return `hace ${Math.round(ms / 1_000)} s`;

  return `hace ${Math.floor(ms / 60_000)} min`;
}
