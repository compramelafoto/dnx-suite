/**
 * El pase de turno entre empleadas. Módulo PURO.
 *
 * Cuando alguien del equipo entra a Caja y el turno abierto de la cuenta lo abrió otra persona,
 * se le pide (sin trabarla) que cuente el dinero y cierre ese turno antes de abrir el suyo. Si
 * elige seguir sin hacerlo, puede vender igual: la venta cae en el turno abierto, como siempre,
 * y el día queda marcado para que lo revise el dueño.
 */
export function debeOfrecerPase(p: {
  /** Quién abrió el turno que está abierto. */
  abiertoPor: number | null;
  usuarioId: number;
  /** Si quien entra tiene ficha activa en Equipo (al dueño no se le pide). */
  usuarioEnEquipo: boolean;
  /** Si ya eligió seguir sin cerrar ese turno. */
  omitido: boolean;
}): boolean {
  if (!p.usuarioEnEquipo || p.omitido) return false;
  if (p.abiertoPor === null) return false;
  return p.abiertoPor !== p.usuarioId;
}
