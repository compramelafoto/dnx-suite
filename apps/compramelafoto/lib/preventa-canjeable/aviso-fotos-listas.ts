/**
 * Marca del aviso "ya están las fotos" de un pack de preventa. La escribe
 * `notifyPreventaPhotosReady` en `Order.redemptionPaymentRefsJson` cuando el fotógrafo toca
 * «Avisar a las familias»; la leen el bot y el aviso automático del álbum para no dar por
 * listas las fotos de un curso que todavía no se subió.
 *
 * Módulo aparte y sin dependencias: lo importan lugares que no pueden cargar el envío de mails.
 */

export const AVISO_FOTOS_LISTAS_KEY = "fotosListasAvisoAt";

/** Fecha (ISO) en que se le avisó a este pack que ya están sus fotos, o null si nunca. */
export function fechaAvisoFotosListas(refs: unknown): string | null {
  if (!refs || typeof refs !== "object" || Array.isArray(refs)) return null;
  const v = (refs as Record<string, unknown>)[AVISO_FOTOS_LISTAS_KEY];
  return typeof v === "string" && v ? v : null;
}
