/**
 * Qué pasa al aceptar una invitación de jurado, según haya o no asignaciones
 * esperando. Antes, no tenerlas cancelaba el alta entera: el jurado quedaba
 * afuera por una decisión que había tomado el organizador, no él.
 */
export type ResultadoDeAceptarInvitacion = {
  aceptaInvitacion: boolean;
  aceptaAsignaciones: boolean;
  aviso: string | null;
};

export function resultadoDeAceptarInvitacion(input: {
  pendingAssignmentsCount: number;
}): ResultadoDeAceptarInvitacion {
  if (input.pendingAssignmentsCount > 0) {
    return { aceptaInvitacion: true, aceptaAsignaciones: true, aviso: null };
  }
  return {
    aceptaInvitacion: true,
    aceptaAsignaciones: false,
    aviso: "Todavía no te asignaron ninguna categoría. Escribile al organizador del concurso.",
  };
}
