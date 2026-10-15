/**
 * Cómo califica un jurado.
 *
 * Se elige al asignar y vale para esa asignación: un mismo jurado puede
 * calificar una categoría con nota y otra eligiendo favoritas.
 *
 * Los nombres son los que usa FotoRank en su propia pantalla de asignaciones.
 * Si acá dijeran otra cosa, la misma decisión tendría dos nombres según desde
 * dónde se mire.
 */

export const METODOS_DE_CALIFICACION = [
  { valor: "SCORE_1_5", etiqueta: "Nota de 1 a 5" },
  { valor: "SCORE_1_10", etiqueta: "Nota de 1 a 10" },
  { valor: "SCORE_0_100", etiqueta: "Nota de 0 a 100" },
  { valor: "YES_NO", etiqueta: "Pasa o no pasa" },
  { valor: "FAVORITES_SELECTION", etiqueta: "Elegir favoritas" },
  { valor: "SELECTION_WITH_QUOTA", etiqueta: "Elegir las mejores, con cupo" },
  { valor: "CRITERIA_BASED", etiqueta: "Criterios múltiples" },
] as const;

export type MetodoDeCalificacion = (typeof METODOS_DE_CALIFICACION)[number]["valor"];

const VALIDOS = new Set<string>(METODOS_DE_CALIFICACION.map((m) => m.valor));

/**
 * Para una maratón, elegir las mejores suele ganarle a poner nota.
 *
 * Son cientos de obras: pedirle una nota a cada una es trabajo que el jurado
 * no va a terminar. El organizador puede cambiarlo, pero lo que se ofrece
 * primero debería ser lo que funciona.
 */
export const METODO_POR_OMISION: MetodoDeCalificacion = "SELECTION_WITH_QUOTA";

export const CUPO_POR_OMISION = 10;

/** La explicación que acompaña a cada método en la pantalla. */
export const QUE_HACE_CADA_METODO: Record<MetodoDeCalificacion, string> = {
  SCORE_1_5: "El jurado le pone una nota del 1 al 5 a cada obra.",
  SCORE_1_10: "El jurado le pone una nota del 1 al 10 a cada obra.",
  SCORE_0_100: "El jurado le pone un puntaje de 0 a 100 a cada obra.",
  YES_NO: "El jurado sólo dice si la obra pasa o no. Sin nota.",
  FAVORITES_SELECTION: "El jurado marca las que más le gustan, sin límite.",
  SELECTION_WITH_QUOTA:
    "El jurado elige una cantidad fija de obras y deja el resto afuera. Es el que mejor funciona cuando hay cientos.",
  CRITERIA_BASED:
    "El jurado puntúa por separado interpretación de la consigna, técnica, composición y creatividad, del 1 al 5, y el sistema promedia. Los cuatro pesan igual.",
};

export function esMetodoValido(valor: string): valor is MetodoDeCalificacion {
  return VALIDOS.has(valor);
}

/**
 * La configuración que acompaña al método.
 *
 * Sólo "elegir con cupo" necesita un dato extra. Los demás se describen solos,
 * y `CRITERIA_BASED` usa los cuatro criterios que ya trae FotoRank: si acá se
 * mandara una lista propia, cada maratón terminaría con criterios distintos
 * sin que nadie lo haya decidido.
 */
export function configDelMetodo(
  metodo: MetodoDeCalificacion,
  cupo: number | null,
): Record<string, unknown> {
  if (metodo !== "SELECTION_WITH_QUOTA") return {};
  const limpio = Number.isFinite(cupo) && (cupo ?? 0) > 0 ? Math.floor(cupo!) : CUPO_POR_OMISION;
  return { quota: limpio };
}
