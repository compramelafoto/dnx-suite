/**
 * Cupos y vacantes, por rol.
 *
 * "Necesito un fotógrafo y un videógrafo" es un rol con una vacante y otro rol con otra
 * vacante, no una cobertura con dos vacantes sueltas — ver el vocabulario de la etapa en el
 * plan. Por eso todo acá razona sobre un solo rol, y `equipoCompleto` es lo único que junta
 * varios.
 *
 * Función pura, sin acceso a la base: quien la llama ya contó las asignaciones vivas del rol
 * — `PROPUESTA | INVITADA | ACEPTADA | CONFIRMADA`, ver `ASSIGNMENT_LIVE_STATUSES` en
 * `states.ts` — y se la pasa como número.
 */
export type EstadoDeRol = {
  vacancies: number;
  /** Asignaciones en PROPUESTA | INVITADA | ACEPTADA | CONFIRMADA. */
  asignadasVivas: number;
};

/**
 * Cuántos lugares quedan. Nunca negativo.
 *
 * Puede haber más asignaciones vivas que vacantes si alguien bajó las vacantes de un rol
 * después de asignar gente: mostrar "-2 lugares" en una pantalla no significa nada para quien
 * coordina, así que el piso es cero.
 */
export function lugaresLibres(r: EstadoDeRol): number {
  return Math.max(0, r.vacancies - r.asignadasVivas);
}

/** Si el rol ya no admite más gente sin bajarle una vacante a alguien. */
export function rolCompleto(r: EstadoDeRol): boolean {
  return r.asignadasVivas >= r.vacancies;
}

/**
 * Si TODOS los roles de la cobertura están completos.
 *
 * Una cobertura sin roles todavía no es "completa": es que nadie generó los roles. Ese caso se
 * escribe aparte para no leer un arreglo vacío como un `every` trivialmente verdadero.
 */
export function equipoCompleto(roles: EstadoDeRol[]): boolean {
  if (roles.length === 0) return false;
  return roles.every(rolCompleto);
}
