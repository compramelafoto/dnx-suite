/**
 * Estado de la ventana de inscripción de una edición.
 *
 * Regla única para la ficha pública. Debe coincidir con `registrationWindowOf`
 * del servicio de inscripción nativa: si la ficha dice "próximamente" y el
 * servicio dice "cerrada", el público lee un motivo falso.
 */

export type PublicRegistrationWindow = "open" | "not_open" | "closed" | "unavailable";

export function resolveRegistrationWindow(input: {
  /** Kill switch comercial: apagado ⇒ nunca se vende, aunque las fechas estén vigentes. */
  registrationEnabled: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  now?: Date;
}): PublicRegistrationWindow {
  if (!input.registrationEnabled) return "unavailable";

  const now = (input.now ?? new Date()).getTime();

  // Sin fecha de apertura ⇒ ya abierta. Sin fecha de cierre ⇒ no vence.
  if (input.registrationOpenAt && input.registrationOpenAt.getTime() > now) {
    return "not_open";
  }
  if (input.registrationCloseAt && input.registrationCloseAt.getTime() < now) {
    return "closed";
  }
  return "open";
}
