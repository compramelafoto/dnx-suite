/**
 * Si un invitado puede subir fotos en este momento (capítulo 7.4).
 *
 * Dos condiciones tienen que darse a la vez: que el reloj esté dentro de la ventana y que
 * el evento no haya sido cerrado o cancelado. Nunca alcanza con una sola — un evento que
 * se canceló no reabre porque el reloj todavía esté en hora, y uno cerrado a mano no
 * vuelve a abrirse solo.
 */

export type MomentoEvento = "ANTES" | "ABIERTO" | "CERRADO";

export type EventoParaAcceso = {
  status: string;
  activationAt: Date | null;
  deactivationAt: Date | null;
};

export type EstadoAcceso = { puedeSubir: boolean; momento: MomentoEvento };

/** Estados que impiden abrir, pase lo que pase con el horario. */
const ESTADOS_TERMINADOS = new Set(["CLOSED", "ARCHIVED", "CANCELLED"]);

export function estadoDeAcceso(evento: EventoParaAcceso, ahora: Date): EstadoAcceso {
  if (ESTADOS_TERMINADOS.has(evento.status)) {
    return { puedeSubir: false, momento: "CERRADO" };
  }

  // Sin horario configurado no hay nada que abrir todavía.
  if (!evento.activationAt || !evento.deactivationAt) {
    return { puedeSubir: false, momento: "ANTES" };
  }

  const t = ahora.getTime();
  const abre = evento.activationAt.getTime();
  const cierra = evento.deactivationAt.getTime();

  if (t < abre) return { puedeSubir: false, momento: "ANTES" };
  // El borde de cierre va cerrado: a las 12 horas exactas se terminó.
  if (t >= cierra) return { puedeSubir: false, momento: "CERRADO" };

  return { puedeSubir: true, momento: "ABIERTO" };
}
