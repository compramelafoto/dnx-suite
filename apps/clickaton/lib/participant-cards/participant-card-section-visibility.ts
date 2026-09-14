/**
 * Qué sección de placas ve el participante en su inscripción.
 *
 * Conviven dos sistemas: el nuevo, que dibuja las dos placas desde una plantilla, y el de
 * siempre, que entrega la placa de bienvenida. La regla que importa es que **quien pagó nunca
 * se queda sin placa**: si el sistema nuevo no está operativo —una variable mal puesta, el
 * motor de dibujo sin configurar—, se muestra el de siempre en lugar de una pantalla vacía.
 *
 * Antes la condición miraba si el sistema nuevo estaba *encendido*, no si estaba *funcionando*.
 * Con la bandera encendida y la configuración incompleta no se mostraba ninguno de los dos.
 */
export type ParticipantCardsSectionsVisibility = {
  /** La sección con las dos placas y sus botones. */
  v2: boolean;
  /** La placa de bienvenida de siempre. */
  legacy: boolean;
};

export function decideParticipantCardsSections(input: {
  paid: boolean;
  /** El sistema nuevo, encendido **y** bien configurado. */
  v2Available: boolean;
}): ParticipantCardsSectionsVisibility {
  if (!input.paid) return { v2: false, legacy: false };
  return { v2: input.v2Available, legacy: !input.v2Available };
}
