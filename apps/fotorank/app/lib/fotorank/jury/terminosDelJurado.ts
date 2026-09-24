/**
 * Lo que el jurado acepta antes de empezar a calificar.
 *
 * A una jurado real de Clickatón le aparecía el borrador de Santa Fe en Foco,
 * con las marcas puestas para que nadie lo publicara: "BORRADOR — LEGAL REVIEW
 * REQUIRED — NO PUBLICAR" y "términos de staging (no constituye aceptación
 * legal definitiva)". Un texto que se declara no válido no sirve para pedirle
 * a alguien que se comprometa, y encima no era el de su concurso.
 *
 * Las obligaciones que enumera son las mismas del borrador, porque son las que
 * ya estaban redactadas; lo que cambia es que ahora se leen como un compromiso
 * y no como una nota interna.
 */

/** Marca qué versión aceptó cada jurado. Cambiarla obliga a aceptar de nuevo. */
export const TERMINOS_CLICKATON_VERSION = "clickaton-jury-terms-v1";
export const TERMINOS_SANTA_FE_VERSION = "sfef-jury-terms-draft-v1";

export function versionDeTerminos(esDeClickaton: boolean): string {
  return esDeClickaton ? TERMINOS_CLICKATON_VERSION : TERMINOS_SANTA_FE_VERSION;
}

export type TextoDeTerminos = {
  titulo: string;
  cuerpo: string;
  casilla: string;
  boton: string;
  /** Aviso para la organización, no para el jurado. Vacío cuando no hace falta. */
  advertencia: string;
};

const CLICKATON: TextoDeTerminos = {
  titulo: "Antes de empezar a calificar",
  cuerpo:
    "Las obras que vas a ver son de participantes que no conocés y no tenés que conocer: " +
    "se muestran sin nombre y con un código. Al continuar te comprometés a mantenerlas en " +
    "reserva, a no compartirlas ni sacarles capturas, a calificar con imparcialidad y a " +
    "avisar si reconocés una obra o tenés alguna relación con quien la hizo. Tus " +
    "calificaciones quedan registradas y son auditables por la organización.",
  casilla: "Entiendo y acepto",
  boton: "Empezar a calificar",
  advertencia: "",
};

const SANTA_FE: TextoDeTerminos = {
  titulo: "Términos de jurado (borrador)",
  cuerpo:
    "Al continuar declarás confidencialidad, imparcialidad, obligación de declarar " +
    "conflictos, prohibición de compartir obras o capturas no autorizadas, respeto del " +
    "anonimato y aceptación de la rúbrica y auditoría.",
  casilla: "Acepto los términos de jurado",
  boton: "Aceptar términos",
  advertencia: "Borrador pendiente de revisión legal. No publicar.",
};

export function textoDeTerminos(esDeClickaton: boolean): TextoDeTerminos {
  return esDeClickaton ? CLICKATON : SANTA_FE;
}
