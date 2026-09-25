/**
 * Los tipos de calificación de FotoRank, sobre un solo motor.
 *
 * El motor de rúbrica sólo sabía calificar con criterios ponderados. Los demás
 * tipos que ofrecía el método viejo (nota única 1 a 5 / 1 a 10 / 0 a 100, sí o
 * no, elegir las mejores con cupo) existían en otra tabla, con otra pantalla y
 * otro cálculo de resultados, que no respetaba el reparto de obras.
 *
 * En vez de un motor por tipo, cada tipo es una rúbrica:
 *
 *   - Criterios: los del concurso, ponderados. Lo de siempre.
 *   - Nota única: un solo criterio con la escala elegida.
 *   - Sí o no: un solo criterio que vale 0 o 1.
 *   - Elegir con cupo: sí o no, con un máximo de "sí" por jurado y por ámbito
 *     (categoría y consigna). El cupo vive en la sesión.
 *
 * Así el guardado, la validación de rango, el reparto por vacante, el ranking
 * y los diplomas son los mismos para todos, y ya están probados.
 */

import type { CriterioDeRubrica } from "./criteriosDeLaRubrica";

export type TipoDeCalificacion = "CRITERIOS" | "NOTA_UNICA" | "SI_NO" | "SELECCION_CON_CUPO";

export type EscalaDeNota = "1_5" | "1_10" | "0_100";

export type ConfiguracionDeCalificacion =
  | { tipo: "CRITERIOS" }
  | { tipo: "NOTA_UNICA"; escala: EscalaDeNota }
  | { tipo: "SI_NO" }
  | { tipo: "SELECCION_CON_CUPO"; cupo: number };

/** Modo guardado en la rúbrica. Son valores del enum `FotorankJuryScoringMode`. */
export type ModoDeRubrica = "WEIGHTED_SCORE" | "AVERAGE" | "APPROVAL";

export const ESCALAS: Record<EscalaDeNota, { min: number; max: number; etiqueta: string }> = {
  "1_5": { min: 1, max: 5, etiqueta: "del 1 al 5" },
  "1_10": { min: 1, max: 10, etiqueta: "del 1 al 10" },
  "0_100": { min: 0, max: 100, etiqueta: "del 0 al 100" },
};

export const CLAVE_NOTA_UNICA = "nota";
export const CLAVE_SELECCION = "elegida";

export const CUPO_MAXIMO = 500;

/** Cómo se lo explicamos al organizador en el selector. */
export const DESCRIPCION_DEL_TIPO: Record<TipoDeCalificacion, string> = {
  CRITERIOS:
    "Cada jurado pone una nota por criterio (composición, técnica…) y el total sale del promedio ponderado.",
  NOTA_UNICA: "Cada jurado pone una sola nota a cada foto.",
  SI_NO: "Cada jurado marca sí o no en cada foto. Gana la que más jurados eligieron.",
  SELECCION_CON_CUPO:
    "Cada jurado elige sus mejores fotos hasta un máximo por categoría y consigna. Gana la que más jurados eligieron.",
};

export function etiquetaDelTipo(c: ConfiguracionDeCalificacion): string {
  switch (c.tipo) {
    case "CRITERIOS":
      return "Criterios del concurso";
    case "NOTA_UNICA":
      return `Nota única ${ESCALAS[c.escala].etiqueta}`;
    case "SI_NO":
      return "Sí o no";
    case "SELECCION_CON_CUPO":
      return `Elegir las mejores (hasta ${c.cupo} por jurado en cada consigna)`;
  }
}

/**
 * La rúbrica que corresponde a un tipo. `criteriosDelConcurso` sólo se usa
 * para el tipo con criterios; si no hay, devuelve `null` y la rúbrica no se
 * puede armar (nadie le inventa criterios a un concurso).
 */
export function rubricaParaTipo(
  c: ConfiguracionDeCalificacion,
  criteriosDelConcurso: CriterioDeRubrica[] | null,
): { modo: ModoDeRubrica; criterios: CriterioDeRubrica[] } | null {
  switch (c.tipo) {
    case "CRITERIOS":
      return criteriosDelConcurso && criteriosDelConcurso.length > 0
        ? { modo: "WEIGHTED_SCORE", criterios: criteriosDelConcurso }
        : null;
    case "NOTA_UNICA": {
      const e = ESCALAS[c.escala];
      return {
        modo: "AVERAGE",
        criterios: [
          {
            key: CLAVE_NOTA_UNICA,
            name: "Nota",
            description: `Una sola nota ${e.etiqueta} para la fotografía.`,
            weight: 1,
            minScore: e.min,
            maxScore: e.max,
            step: 1,
            required: true,
            sortOrder: 10,
          },
        ],
      };
    }
    case "SI_NO":
    case "SELECCION_CON_CUPO":
      return {
        modo: "APPROVAL",
        criterios: [
          {
            key: CLAVE_SELECCION,
            name: "Elegida",
            description:
              c.tipo === "SI_NO"
                ? "Sí si la fotografía merece seguir; no si no."
                : `Marcá sí en tus mejores fotos, hasta ${c.cupo}.`,
            weight: 1,
            minScore: 0,
            maxScore: 1,
            step: 1,
            required: true,
            sortOrder: 10,
          },
        ],
      };
  }
}

/**
 * El tipo de una rúbrica ya guardada. Sale del modo y del criterio único; el
 * cupo, de la sesión. Una rúbrica vieja sin modo reconocible cuenta como
 * criterios, que es lo que siempre fue.
 */
export function tipoDeLaRubrica(input: {
  modo: string;
  criterios: Array<{ key: string; minScore: number; maxScore: number }>;
  cupo: number | null;
}): ConfiguracionDeCalificacion {
  const unico = input.criterios.length === 1 ? input.criterios[0]! : null;
  if (input.modo === "APPROVAL" || (unico && unico.key === CLAVE_SELECCION)) {
    return input.cupo && input.cupo > 0
      ? { tipo: "SELECCION_CON_CUPO", cupo: input.cupo }
      : { tipo: "SI_NO" };
  }
  if (unico && unico.key === CLAVE_NOTA_UNICA) {
    const escala = (Object.keys(ESCALAS) as EscalaDeNota[]).find(
      (k) => ESCALAS[k].min === unico.minScore && ESCALAS[k].max === unico.maxScore,
    );
    if (escala) return { tipo: "NOTA_UNICA", escala };
  }
  return { tipo: "CRITERIOS" };
}

/** Lee el cupo guardado en la metadata de la sesión. */
export function cupoDeLaSesion(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const v = (metadata as Record<string, unknown>).cupoDeSeleccion;
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

/** Valida lo que llega del formulario del organizador. */
export function leerConfiguracion(input: {
  tipo: string;
  escala?: string | null;
  cupo?: string | number | null;
}): ConfiguracionDeCalificacion | { error: string } {
  switch (input.tipo) {
    case "CRITERIOS":
      return { tipo: "CRITERIOS" };
    case "NOTA_UNICA": {
      const escala = input.escala as EscalaDeNota;
      if (!escala || !(escala in ESCALAS)) return { error: "Elegí la escala de la nota." };
      return { tipo: "NOTA_UNICA", escala };
    }
    case "SI_NO":
      return { tipo: "SI_NO" };
    case "SELECCION_CON_CUPO": {
      const cupo = Number(input.cupo);
      if (!Number.isInteger(cupo) || cupo < 1 || cupo > CUPO_MAXIMO) {
        return { error: `El cupo tiene que ser un número entero entre 1 y ${CUPO_MAXIMO}.` };
      }
      return { tipo: "SELECCION_CON_CUPO", cupo };
    }
    default:
      return { error: "Tipo de calificación desconocido." };
  }
}

/**
 * Cómo se juntan las notas de varios jurados para cada tipo.
 *
 * Con sí o no, el promedio de las notas normalizadas es la proporción de
 * jurados que eligieron la foto: dos de tres es 0,67. Con nota única y
 * criterios, el promedio común. Se ordena igual en los dos casos.
 */
export function agregacionParaTipo(c: ConfiguracionDeCalificacion): "WEIGHTED_AVERAGE" | "AVERAGE" {
  return c.tipo === "CRITERIOS" ? "WEIGHTED_AVERAGE" : "AVERAGE";
}
