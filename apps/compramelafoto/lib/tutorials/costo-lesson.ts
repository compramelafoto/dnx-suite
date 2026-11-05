/**
 * El video 1-B, «¿Cuánto cuesta ComprameLaFoto?»: va en todos los cursos, justo después de la
 * clase 1, para que de entrada se sepa cuánto se paga. El copy sale de
 * docs/demos/tutoriales/comun/generar.py.
 */

import type { CourseExtraLesson } from "./course";
import { COSTO_LESSON_DETAIL } from "./costo-lesson-detail";

export const COSTO_LESSON: CourseExtraLesson = {
  label: "1-B",
  afterLesson: 1,
  title: "¿Cuánto cuesta ComprameLaFoto?",
  audience: "Fotógrafo",
  summary: "Cero pesos por mes: un 15 % sobre lo que vendés, que paga el cliente.",
  videoUrl: null,
  detail: COSTO_LESSON_DETAIL,
};
