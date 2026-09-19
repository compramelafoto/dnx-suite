/**
 * "Terminé de subir mis fotos".
 *
 * Declaración explícita del participante de que su entrega está completa. No
 * reemplaza al cierre por horario: sirve para que sepa que terminó bien y para
 * que la organización distinga a quien ya cerró de quien todavía está subiendo.
 */

export type EntregaParaFinalizar = {
  finalizadaEn: Date | null;
  fotosEnviadas: number;
  /** La ventana de entrega de la edición sigue abierta. */
  entregaAbierta: boolean;
};

export type EstadoFinalizacion = "YA_FINALIZADA" | "PUEDE_FINALIZAR" | "SIN_FOTOS";

export function estadoDeFinalizacion(entrega: EntregaParaFinalizar): EstadoFinalizacion {
  // Lo que ya pasó manda: una entrega finalizada se muestra así aunque hoy no
  // se cumplan las condiciones para finalizarla.
  if (entrega.finalizadaEn) return "YA_FINALIZADA";
  // Sin una sola foto no hay nada que declarar.
  if (entrega.fotosEnviadas <= 0) return "SIN_FOTOS";
  // Que la ventana haya cerrado no impide declarar: cerrar por horario no es
  // lo mismo que decir "terminé".
  return "PUEDE_FINALIZAR";
}

export function puedeFinalizarAhora(entrega: EntregaParaFinalizar): boolean {
  return estadoDeFinalizacion(entrega) === "PUEDE_FINALIZAR";
}
