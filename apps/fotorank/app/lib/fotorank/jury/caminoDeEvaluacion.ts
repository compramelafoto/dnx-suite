/**
 * Por dónde califica un jurado.
 *
 * En FotoRank conviven dos motores de evaluación, y el panel ofrecía los dos:
 * "Ver obras anónimas" llevaba al de la rúbrica y "Evaluar" —el botón
 * destacado— al viejo. Quien apretaba el destacado terminaba en la pantalla
 * equivocada, y ahí:
 *
 *   - veía **todas** las obras de su categoría, porque ese camino filtra por
 *     categoría y no sabe nada de vacantes ni de consignas: 270 en vez de las
 *     170 que le tocaban;
 *   - calificaba con **un puntaje único** en lugar de los cuatro criterios de
 *     las bases, porque el motor viejo usa `methodType` y no la rúbrica.
 *
 * Con un lote congelado sólo sirve el camino de la rúbrica. El viejo se
 * conserva para los concursos de FotoRank que no pasan por admisión.
 */

export const MOTIVO_DEL_CAMINO_VIEJO =
  "Esta maratón tiene las obras congeladas y repartidas por vacante. La evaluación va " +
  "por el panel de obras, que respeta el reparto y usa los criterios de las bases.";

export type CaminoDeEvaluacion = {
  href: string;
  etiqueta: string;
  /** Si el destino muestra sólo las obras que le tocan a este jurado. */
  respetaElReparto: boolean;
};

export function caminoDeEvaluacion(input: {
  hayLoteCongelado: boolean;
  contestId: string;
  assignmentId: string;
}): CaminoDeEvaluacion {
  if (input.hayLoteCongelado) {
    return {
      href: `/jurado/concursos/${input.contestId}`,
      etiqueta: "Calificar obras",
      respetaElReparto: true,
    };
  }
  return {
    href: `/jurado/asignaciones/${input.assignmentId}/evaluar`,
    etiqueta: "Calificar obras",
    respetaElReparto: false,
  };
}
