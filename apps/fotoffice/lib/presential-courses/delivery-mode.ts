/**
 * Cómo se dicta un curso.
 *
 * De la modalidad depende qué le cuelga: un curso que se dicta en una fecha y un lugar tiene
 * **ediciones** (`CourseInstance`); uno grabado tiene **clases** (`CourseLesson`) y se mira
 * cuando el alumno quiere. Son dos formas distintas de vender lo mismo y no se mezclan.
 *
 * `PRESENCIAL` es el default para que los cursos que ya existen no cambien de comportamiento.
 */
export type CourseDeliveryMode = "PRESENCIAL" | "LIVE" | "RECORDED";

export const MODALIDADES: readonly CourseDeliveryMode[] = ["PRESENCIAL", "LIVE", "RECORDED"];

const ETIQUETAS: Record<CourseDeliveryMode, string> = {
  PRESENCIAL: "Presencial",
  LIVE: "En vivo",
  RECORDED: "Grabado",
};

export function etiquetaDeModalidad(modo: CourseDeliveryMode): string {
  return ETIQUETAS[modo];
}

/** Sólo el grabado se organiza en clases. El resto necesita fecha, lugar y cupo. */
export function esGrabado(modo: CourseDeliveryMode): boolean {
  return modo === "RECORDED";
}

/**
 * La regla que impide el estado imposible: un curso con ediciones Y clases.
 *
 * El mensaje del curso en vivo habla de "presencial" a propósito: en pantalla ese curso
 * también carga encuentros con fecha, y hoy no hay otra palabra que le quede mejor. Cuando
 * exista la etapa de cursos en vivo, el texto se ajusta.
 */
export function validarModalidad(input: {
  deliveryMode: CourseDeliveryMode;
  tieneEdicion: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (esGrabado(input.deliveryMode) && input.tieneEdicion) {
    return { ok: false, error: "Un curso grabado no tiene ediciones: se organiza en clases." };
  }
  if (!esGrabado(input.deliveryMode) && !input.tieneEdicion) {
    return {
      ok: false,
      error: "Un curso presencial necesita al menos una edición con fecha y lugar.",
    };
  }
  return { ok: true };
}
