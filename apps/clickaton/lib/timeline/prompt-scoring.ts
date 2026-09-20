/**
 * Consignas que puntúan para el concurso.
 *
 * Regla de producto: una edición puede tener consignas "sorpresa extra" que se
 * entregan y se preseleccionan, pero **no** entran en la calificación ni en el
 * ranking. El caso que la estrenó es Claroscuro en la 1º edición: sus fotos
 * preseleccionadas quedan invitadas a una muestra, no compiten por el premio.
 *
 * El denominador del reglamento (8 de 10) sale de las consignas que puntúan,
 * nunca del total de filas de la edición: sumar una consigna extra no puede
 * mover la exigencia para el participante.
 *
 * Módulo puro (sin Prisma) para poder testearlo sin base.
 */

export type ScoringPrompt = { countsForScoring: boolean };

/** `true` cuando la consigna entra en la calificación. */
export function isScoringPrompt(prompt: ScoringPrompt): boolean {
  return prompt.countsForScoring;
}

/** Sólo las consignas que puntúan. Las extra quedan afuera del jurado. */
export function filterScoringPrompts<T extends ScoringPrompt>(prompts: T[]): T[] {
  return prompts.filter(isScoringPrompt);
}

/** Cuántas consignas puntúan — el denominador del reglamento. */
export function countScoringPrompts(prompts: ScoringPrompt[]): number {
  return filterScoringPrompts(prompts).length;
}

/** Las que se entregan pero no puntúan, para poder nombrarlas en pantalla. */
export function filterExtraPrompts<T extends ScoringPrompt>(prompts: T[]): T[] {
  return prompts.filter((prompt) => !isScoringPrompt(prompt));
}
