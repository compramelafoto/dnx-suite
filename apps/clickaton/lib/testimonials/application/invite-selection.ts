/**
 * Qué ediciones ya están en condiciones de invitar a testimoniar.
 *
 * Función pura: la decisión de "¿ya pasó el tiempo?" se puede probar sin reloj
 * del sistema ni base de datos.
 */

export const TESTIMONIAL_INVITE_TEMPLATE_KEY = "CLICKATON_TESTIMONIAL_INVITE";
export const TESTIMONIAL_INVITE_TEMPLATE_VERSION = "v1";

export function testimonialInviteIdempotencyKey(inviteId: string): string {
  return `${inviteId}:${TESTIMONIAL_INVITE_TEMPLATE_KEY}:${TESTIMONIAL_INVITE_TEMPLATE_VERSION}`;
}

export type InvitableEdition = {
  id: string;
  testimonialsEnabled: boolean;
  testimonialInviteDelayDays: number;
  endAt: Date | null;
  isOpsFixture: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function selectEditionsReadyForInvites<T extends InvitableEdition>(
  editions: readonly T[],
  now: Date,
): T[] {
  return editions.filter((edition) => {
    if (!edition.testimonialsEnabled) return false;
    if (edition.isOpsFixture) return false;
    if (!edition.endAt) return false;

    const delayDays = Math.max(0, edition.testimonialInviteDelayDays);
    const readyAt = edition.endAt.getTime() + delayDays * DAY_MS;
    return now.getTime() >= readyAt;
  });
}

/**
 * Si una edición puede disparar invitaciones, y por qué camino.
 *
 * Una edición de prueba nunca manda el envío masivo — sus inscripciones pueden
 * tener correos de personas reales. Invitar a UNA inscripción elegida a mano sí
 * se permite: es un admin apuntando a alguien concreto, que es justamente cómo
 * se prueba el circuito sin escribirle a nadie más.
 */
export function canInviteEdition(
  edition: { testimonialsEnabled: boolean; isOpsFixture: boolean },
  options: { single: boolean },
): boolean {
  if (!edition.testimonialsEnabled) return false;
  if (edition.isOpsFixture && !options.single) return false;
  return true;
}
