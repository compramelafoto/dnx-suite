import { textoDeFrescura } from "./frescura";

/**
 * Cómo avisa el control en vivo que llegó algo nuevo.
 *
 * **La lista no se mueve sola, a propósito.** Está ordenada por lo último que llegó, así
 * que cada actualización corre las fotos de lugar — y en esta pantalla un toque saca algo
 * de la pared del salón sin preguntar. Refrescando sola, una foto que aparece justo
 * mientras el dedo baja hace que se saque la de al lado, a las dos de la mañana, con
 * música fuerte.
 *
 * Entonces se mira seguido pero no se toca nada: aparece el aviso y la lista se actualiza
 * cuando el fotógrafo decide. El precio es que la lista está deliberadamente vieja, y por
 * eso el cartel de "hace cuánto" dejó de ser un adorno: es la única forma de saber si lo
 * que se ve sigue siendo lo que hay.
 */

/** Pasado este rato sin una respuesta del servidor ya no se sabe nada. */
const SE_COLGO_MS = 10 * 60_000;

export function textoDeNovedades(cuantas: number): string {
  if (cuantas <= 0) return "";

  // "1 nuevas" es el error que delata que nadie leyó el cartel.
  return cuantas === 1 ? "Hay 1 nueva" : `Hay ${cuantas} nuevas`;
}

export type EstadoDeVigilancia =
  /** Nada nuevo desde la última mirada. */
  | { tipo: "AL_DIA"; texto: string }
  /** Llegó algo. La lista no cambió todavía. */
  | { tipo: "HAY_NUEVAS"; texto: string; cuantas: number }
  /** Hace rato que no hay respuesta: no sabemos qué hay. */
  | { tipo: "COLGADO"; texto: string };

export function estadoDeVigilancia(entrada: {
  cuantas: number;
  msDesdeLaUltimaMirada: number;
}): EstadoDeVigilancia {
  /*
    Colgado gana sobre todo lo demás.

    Si hace diez minutos que no hay respuesta, el número de novedades que tenemos guardado
    es de hace diez minutos: decir "al día" o "hay 2 nuevas" sería mentir con precisión.
    Lo único verdadero es que no sabemos.
  */
  if (entrada.msDesdeLaUltimaMirada >= SE_COLGO_MS) {
    return { tipo: "COLGADO", texto: textoDeFrescura(entrada.msDesdeLaUltimaMirada) };
  }

  if (entrada.cuantas > 0) {
    return {
      tipo: "HAY_NUEVAS",
      texto: textoDeNovedades(entrada.cuantas),
      cuantas: entrada.cuantas,
    };
  }

  return { tipo: "AL_DIA", texto: textoDeFrescura(entrada.msDesdeLaUltimaMirada) };
}
