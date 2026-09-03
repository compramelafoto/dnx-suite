/**
 * Cuaderno del participante: reglas puras, sin base de datos.
 *
 * Dos decisiones viven acá:
 * 1. Qué escritura gana cuando la misma persona escribe desde el teléfono en la
 *    calle y desde la computadora en casa.
 * 2. Cuándo una nota ya cumplió sus 30 días y se puede borrar.
 */

/** Es un cuaderno, no un documento. */
export const MAX_NOTE_LENGTH = 2000;

/** Las notas se conservan 30 días después de que cierra la entrega. */
export const NOTE_RETENTION_DAYS = 30;

const DAY_MS = 86_400_000;

/** Recorta y normaliza lo que llega del navegador antes de guardarlo. */
export function normalizeNoteBody(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\r\n/g, "\n").slice(0, MAX_NOTE_LENGTH);
}

/**
 * ¿Se acepta esta escritura?
 *
 * Gana la más reciente según el reloj del dispositivo que escribió. Una
 * escritura sin marca de tiempo se acepta siempre: es un cliente viejo o una
 * llamada manual, y perder la nota es peor que perder el orden.
 *
 * Una marca igual a la guardada se acepta: es el mismo envío reintentado
 * después de un corte de señal, y rechazarlo dejaría la nota a medias.
 */
export function shouldAcceptNoteWrite(input: {
  storedClientUpdatedAt: Date | null | undefined;
  incomingClientUpdatedAt: Date | null | undefined;
}): boolean {
  const stored = input.storedClientUpdatedAt;
  const incoming = input.incomingClientUpdatedAt;
  if (!stored) return true;
  if (!incoming) return true;
  return incoming.getTime() >= stored.getTime();
}

/**
 * Momento a partir del cual las notas de una edición ya vencieron.
 *
 * No se guarda en la fila: se calcula al borrar. Así, si el cronograma se
 * mueve, el plazo se corrige solo y no quedan fechas viejas en miles de filas.
 */
export function noteRetentionCutoff(
  now: Date,
  days: number = NOTE_RETENTION_DAYS,
): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

/**
 * ¿Se pueden borrar las notas de esta edición?
 *
 * Una edición sin cierre de entrega cargado nunca se borra: sin fecha no hay
 * plazo que contar, y borrar por las dudas es peor que conservar de más.
 */
export function areEditionNotesExpired(input: {
  uploadWindowEndsAt: Date | null | undefined;
  now: Date;
  days?: number;
}): boolean {
  if (!input.uploadWindowEndsAt) return false;
  return (
    input.uploadWindowEndsAt.getTime() <
    noteRetentionCutoff(input.now, input.days ?? NOTE_RETENTION_DAYS).getTime()
  );
}
