import { openingWhenText } from "@repo/muestras";

/** "Sala, Calle 1, Rosario": lo que va en el calendario, los correos y la invitación. */
export function lugarDeLaInauguracion(a: { venueName: string | null; address: string | null; city: string | null }): string {
  return [a.venueName, a.address, a.city].map((x) => x?.trim()).filter(Boolean).join(", ");
}

/** Día y hora, o sólo el día si la inauguración no tiene hora. */
export function cuandoEsLaInauguracion(a: { openingAt: Date | null; openingEndsAt: Date | null }): string {
  return a.openingAt ? openingWhenText(a.openingAt, a.openingEndsAt) : "";
}
