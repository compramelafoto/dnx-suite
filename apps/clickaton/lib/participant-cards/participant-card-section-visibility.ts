/**
 * Qué sección de placas ve el participante en su inscripción.
 *
 * Conviven dos sistemas: el nuevo, que dibuja las dos placas desde una plantilla, y el de
 * siempre, que entrega la placa de bienvenida. Dos reglas gobiernan la decisión:
 *
 * 1. **Quien pagó nunca se queda sin placa.** Si el sistema nuevo no está operativo —una
 *    variable mal puesta, el motor de dibujo sin configurar—, se muestra el de siempre en
 *    lugar de una pantalla vacía. Antes la condición miraba si el sistema nuevo estaba
 *    *encendido*, no si estaba *funcionando*: encendido y mal configurado no se veía ninguno.
 *
 * 2. **Generar y mostrar son dos llaves distintas.** Se puede estar generando el backlog de
 *    placas con la vitrina todavía apagada, para comprobar que salieron bien antes de
 *    mostrárselas a nadie. Con una sola llave, el primer intento fallido lo ve el participante.
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
  /**
   * La vitrina: si el participante puede ver la sección nueva. Ausente equivale a encendida,
   * para que el único motivo de ocultarla sea pedirlo expresamente.
   */
  publicUiEnabled?: boolean;
}): ParticipantCardsSectionsVisibility {
  if (!input.paid) return { v2: false, legacy: false };
  const mostrarV2 = input.v2Available && (input.publicUiEnabled ?? true);
  return { v2: mostrarV2, legacy: !mostrarV2 };
}
