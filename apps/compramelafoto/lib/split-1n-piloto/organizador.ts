import { prisma } from "@/lib/prisma";

export type OrganizadorPiloto = {
  userId: number;
  /** Comisión del organizador sobre el precio de la foto; 0 si el evento no la tiene activa. */
  porcentaje: number;
  /** `organizerCommissionEnabled` del evento (aunque el porcentaje sea 0). */
  comisionActiva: boolean;
  /** Referidor activo del organizador en el programa de organizadores, con Mercado Pago vinculado. */
  referrerUserId: number | null;
};

/**
 * Organizador del evento de un álbum, con el mismo criterio que la contabilidad de CLF:
 * el organizador es quien creó el evento (`ensureEventOrganizerCommissionSnapshotForPaidOrder`
 * y `createReferralEarningsForPaidSale` lo resuelven igual).
 */
export async function buscarOrganizador(eventId: number | null | undefined): Promise<OrganizadorPiloto | null> {
  if (eventId == null) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { creatorId: true, organizerCommissionEnabled: true, organizerCommissionPercentage: true },
  });
  if (!event) return null;
  const pct = event.organizerCommissionPercentage;
  const porcentaje =
    event.organizerCommissionEnabled && pct != null && Number.isFinite(pct) && pct > 0 ? pct : 0;
  const attribution = await prisma.referralAttribution.findFirst({
    where: {
      referredUserId: event.creatorId,
      // Literal y no el enum: así la ruta de pedidos no carga el módulo de referidos.
      referralProgram: "ORGANIZER_REFERRAL",
      status: "ACTIVE",
      endsAt: { gt: new Date() },
      // Como `referrerHasMp` de CLF: sin Mercado Pago vinculado no se le genera comisión.
      referrerUser: { OR: [{ mpUserId: { not: null } }, { mpConnectedAt: { not: null } }] },
    },
    select: { referrerUserId: true },
  });
  return {
    userId: event.creatorId,
    porcentaje,
    comisionActiva: event.organizerCommissionEnabled,
    referrerUserId: attribution?.referrerUserId ?? null,
  };
}
