/**
 * Cupos y vacantes, por rol.
 *
 * "Necesito un fotógrafo y un videógrafo" es un rol con una vacante y otro rol con otra
 * vacante, no una cobertura con dos vacantes sueltas — ver el vocabulario de la etapa en el
 * plan. Por eso todo acá razona sobre un solo rol, y `equipoConfirmado` /
 * `todosLosRolesCompletos` son lo único que junta varios.
 *
 * Función pura, sin acceso a la base: quien la llama ya contó las asignaciones del rol — según
 * `ASSIGNMENT_LIVE_STATUSES` y el subconjunto que ya aceptó, ver `states.ts` — y se las pasa
 * como números.
 */
export type EstadoDeRol = {
  vacancies: number;
  /** Asignaciones en PROPUESTA | INVITADA | ACEPTADA | CONFIRMADA: ocupan lugar aunque la
   * persona todavía no haya respondido. */
  asignadasVivas: number;
  /** Asignaciones en ACEPTADA | CONFIRMADA: las que ya dijeron que sí. */
  asignadasAceptadas: number;
};

/**
 * Cuántos lugares quedan para invitar. Nunca negativo.
 *
 * Puede haber más asignaciones vivas que vacantes si alguien bajó las vacantes de un rol
 * después de asignar gente: mostrar "-2 lugares" en una pantalla no significa nada para quien
 * coordina, así que el piso es cero.
 */
export function lugaresLibres(r: EstadoDeRol): number {
  return Math.max(0, r.vacancies - r.asignadasVivas);
}

/**
 * Si el rol ya no admite invitar a nadie más sin bajarle una vacante a alguien.
 *
 * Cuenta las asignaciones vivas, no las aceptadas: si ya se invitó a alguien y todavía no
 * contestó, el lugar está ocupado igual — invitar a una segunda persona para el mismo lugar es
 * el bug que esto evita, no una casualidad rara.
 */
export function rolCompleto(r: EstadoDeRol): boolean {
  return r.asignadasVivas >= r.vacancies;
}

/**
 * Si TODOS los roles de la cobertura tienen su gente y esa gente YA ACEPTÓ.
 *
 * Distinto de que los roles estén completos (`todosLosRolesCompletos`): se puede haber
 * invitado a todo el mundo y que nadie haya contestado todavía. Devolver `true` acá antes de
 * que alguien diga que sí sería avisarle a la organización solicitante que ya tiene equipo
 * cuando en realidad no tiene a nadie confirmado.
 *
 * Una cobertura sin roles no tiene equipo confirmado — no es que nadie generó los roles
 * cuenta como "confirmado", sería leer un arreglo vacío como un `every` trivialmente
 * verdadero.
 */
export function equipoConfirmado(roles: EstadoDeRol[]): boolean {
  if (roles.length === 0) return false;
  return roles.every((r) => r.asignadasAceptadas >= r.vacancies);
}

/**
 * Si ya no queda a quién invitar en ningún rol.
 *
 * Esto es sobre ocupación de lugares, no sobre respuestas: usarlo para mostrar "equipo
 * confirmado" sería el mismo error que motivó separar `rolCompleto` de la aceptación.
 */
export function todosLosRolesCompletos(roles: EstadoDeRol[]): boolean {
  if (roles.length === 0) return false;
  return roles.every(rolCompleto);
}
