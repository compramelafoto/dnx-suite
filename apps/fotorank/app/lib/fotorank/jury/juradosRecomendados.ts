/**
 * Cuántos jurados conviene tener para el volumen de obras.
 *
 * **Recomienda, no bloquea.** El organizador conoce su concurso y puede tener
 * razones para ir con menos gente; lo que no puede es no haberse enterado de
 * cuánto trabajo le está pidiendo a cada uno.
 *
 * El tope de fotos por jurado sale de `recommendedMaxEntriesPerJudge`, que ya
 * existe en la sesión de puntuación desde julio con el comentario "recomendación
 * de carga (no bloqueante)" — y que hasta ahora no leía nadie.
 */
import { CLICKATON_MIN_EVALUACIONES_POR_OBRA } from "./criteriosDeLaRubrica";

/**
 * Cuántas fotos se le piden a un jurado antes de sumar otro.
 *
 * Doscientas con cuatro criterios son ochocientas notas: una tarde larga. Más
 * que eso y las últimas se califican cansado, que es la forma silenciosa de
 * que el orden decida el resultado.
 */
export const TOPE_DE_FOTOS_POR_JURADO_POR_OMISION = 200;

export type Recomendacion = {
  recomendados: number;
  /** Una frase que se muestra tal cual, con la cuenta a la vista. */
  motivo: string;
};

export function juradosRecomendados(input: {
  obras: number;
  miradasPorObra: number;
  topeDeFotosPorJurado: number;
}): Recomendacion | null {
  if (!Number.isFinite(input.obras) || input.obras < 1) return null;

  const tope =
    Number.isFinite(input.topeDeFotosPorJurado) && input.topeDeFotosPorJurado > 0
      ? Math.floor(input.topeDeFotosPorJurado)
      : TOPE_DE_FOTOS_POR_JURADO_POR_OMISION;

  const miradas = Number.isFinite(input.miradasPorObra)
    ? Math.max(1, Math.floor(input.miradasPorObra))
    : 1;

  const evaluaciones = Math.floor(input.obras) * miradas;
  const porCarga = Math.ceil(evaluaciones / tope);
  const recomendados = Math.max(CLICKATON_MIN_EVALUACIONES_POR_OBRA, porCarga);

  return {
    recomendados,
    motivo:
      `${Math.floor(input.obras)} obras con ${miradas} ` +
      `mirada${miradas === 1 ? "" : "s"} cada una son ${evaluaciones} evaluaciones; ` +
      `a ${tope} fotos por jurado hacen falta ${recomendados}.`,
  };
}
