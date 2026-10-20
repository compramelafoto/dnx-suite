/**
 * A qué foto se le cuenta una reacción.
 *
 * **La pantalla del salón es la única que sabe qué se está viendo**: la rotación la
 * decide ella, con su propio reloj, no el servidor. Por eso avisa en cada cambio y acá
 * se decide si ese aviso todavía vale.
 *
 * Una reacción sin foto no se pierde: se guarda igual y suma al total del evento. Lo
 * único que no tiene es a quién atribuirse.
 */

/**
 * Cuánto vale un aviso de la pantalla.
 *
 * Una foto dura siete segundos y el QR doce, así que treinta cubren cualquier turno con
 * margen. Pasado eso, la pantalla se apagó, se cortó el wifi o alguien cerró el
 * navegador: lo anotado ya no es lo que el salón está viendo, y atribuirle una reacción
 * sería inventar un dato.
 */
export const VENCIMIENTO_DEL_AVISO_MS = 30_000;

export function fotoALaQueReacciona({
  mediaId,
  avisadoEl,
  ahora,
}: {
  mediaId: string | null;
  avisadoEl: Date | null;
  ahora: Date;
}): string | null {
  if (!mediaId || !avisadoEl) return null;
  if (ahora.getTime() - avisadoEl.getTime() > VENCIMIENTO_DEL_AVISO_MS) return null;

  return mediaId;
}
