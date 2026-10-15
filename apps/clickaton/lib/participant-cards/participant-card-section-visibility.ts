/**
 * Si el participante ve la sección de placas en su inscripción.
 *
 * Generar y mostrar son dos llaves distintas: se puede estar generando el backlog de placas
 * con la vitrina todavía apagada, para comprobar que salieron bien antes de mostrárselas a
 * nadie. Con una sola llave, el primer intento fallido lo ve el participante.
 *
 * Hasta octubre de 2026 convivía con el generador viejo de la placa de bienvenida, que se
 * mostraba cuando el nuevo no estaba operativo. Se dio de baja: dibujaba los textos como
 * cuadraditos porque el servidor no tiene tipografías.
 */
export type ParticipantCardsSectionsVisibility = {
  /** La sección con las dos placas y sus botones. */
  v2: boolean;
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
  if (!input.paid) return { v2: false };
  return { v2: input.v2Available && (input.publicUiEnabled ?? true) };
}
