/**
 * Quién puede postularse a un rol, y si no, por qué.
 *
 * Es voluntariado, no una búsqueda laboral: los mensajes son amables a propósito. "Postulación
 * duplicada" o "no cumplís los requisitos" son frases de sistema de recursos humanos, no de
 * alguien agradeciéndote que quieras ayudar.
 *
 * A propósito, este tipo no lleva cuántas vacantes quedan en el rol: cupos (`cupos.ts`) y
 * elegibilidad son preguntas distintas. Un rol completo no bloquea la postulación — el
 * coordinador puede querer suplentes — así que esa información ni siquiera entra acá.
 */
export type CandidatoAConvocatoria = {
  tienePerfilActivo: boolean;
  yaSePostulo: boolean;
  yaEstaAsignado: boolean;
  convocatoriaStatus: string;
  cierreDePostulaciones: Date | null;
};

export type Elegibilidad = { puede: true } | { puede: false; motivo: string };

/**
 * Si esta persona puede postularse a este rol, y si no, por qué.
 *
 * El orden de las reglas importa y está fijado por el plan: cada una se evalúa después de la
 * anterior, así que el mensaje que recibe la persona es siempre el de la primera causa real,
 * no el de la más "grave" a criterio de quien programa.
 */
export function puedePostularse(c: CandidatoAConvocatoria, ahora: Date): Elegibilidad {
  if (!c.tienePerfilActivo) {
    return { puede: false, motivo: "Todavía no estás habilitado para anotarte." };
  }
  if (c.convocatoriaStatus !== "PUBLICADA") {
    return { puede: false, motivo: "Esta convocatoria no está abierta." };
  }
  if (c.cierreDePostulaciones !== null && ahora > c.cierreDePostulaciones) {
    return { puede: false, motivo: "El plazo para anotarse ya cerró." };
  }
  if (c.yaEstaAsignado) {
    return { puede: false, motivo: "Ya estás en el equipo de esta cobertura." };
  }
  if (c.yaSePostulo) {
    return { puede: false, motivo: "Ya te anotaste." };
  }
  return { puede: true };
}
