/**
 * Invitar fotógrafos solo tiene sentido mientras el evento no terminó.
 * Hay organizadores que cargan el evento días después de que ocurrió (para
 * publicar las fotos); sin este corte, los fotógrafos reciben la invitación tarde.
 * Si el evento no tiene hora de fin, se toma la de inicio.
 */
export function eventAcceptsNearbyInvites(
  event: { startsAt: Date; endsAt: Date | null },
  now: Date = new Date()
): boolean {
  const end = event.endsAt ?? event.startsAt;
  return end.getTime() > now.getTime();
}

export const EVENT_ALREADY_ENDED_INVITE_MESSAGE =
  "El evento ya terminó; no se enviaron invitaciones a fotógrafos cercanos.";
