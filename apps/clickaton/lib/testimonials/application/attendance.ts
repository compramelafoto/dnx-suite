/**
 * La encuesta es para quien participó, no para quien se anotó.
 *
 * Preguntarle "¿cómo te fue?" a alguien que se inscribió y no fue es raro para
 * esa persona y ensucia el promedio con una nota de algo que no vivió.
 *
 * El respaldo importa: si en esa edición NADIE figura acreditado, es que la
 * edición no usó el módulo de acreditación, no que no fue nadie. En ese caso
 * entran todos — quedarse sin invitar a nadie sería peor, y el silencio
 * parecería que anda bien.
 */
export function keepWhoAttended<T extends { attended: boolean }>(
  recipients: readonly T[],
): T[] {
  const attended = recipients.filter((r) => r.attended);
  if (attended.length === 0) return [...recipients];
  return attended;
}
