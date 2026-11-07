/** Plazo para que el cliente cancele o reprograme por su enlace. Módulo PURO. */

/** El último instante en que el cliente todavía puede cambiar el turno. */
export function limiteParaGestionar(inicio: Date, horas: number): Date {
  return new Date(inicio.getTime() - horas * 3_600_000);
}

export function puedeGestionarse(inicio: Date, ahora: Date, horas: number): boolean {
  return ahora.getTime() <= limiteParaGestionar(inicio, horas).getTime();
}
