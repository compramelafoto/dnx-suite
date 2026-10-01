/**
 * Cuándo un evento se cierra solo.
 *
 * La ventana ya la controla `acceso-evento` a la hora de dejar subir. Esto es
 * distinto: pasa el estado a `CLOSED` en la base, que es lo que hace que la
 * pantalla muestre la placa final y que el evento deje de figurar como en curso.
 *
 * Las dos reglas tienen que coincidir en el borde. Si una dijera que a las 12
 * horas exactas todavía se puede subir y la otra que ya cerró, el invitado vería
 * una cosa y la base diría otra.
 */

export type EventoParaCerrar = {
  status: string;
  deactivationAt: Date | null;
};

/** Estados que todavía pueden cerrarse. El resto ya terminó o ni empezó. */
const CERRABLES = new Set(["ACTIVE", "SCHEDULED"]);

export function debeCerrarse(evento: EventoParaCerrar, ahora: Date): boolean {
  if (!CERRABLES.has(evento.status)) return false;
  if (!evento.deactivationAt) return false;
  // Borde cerrado, igual que en `acceso-evento`.
  return ahora.getTime() >= evento.deactivationAt.getTime();
}
