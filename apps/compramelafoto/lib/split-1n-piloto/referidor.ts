import { prisma } from "@/lib/prisma";

/**
 * Referidor activo del fotógrafo en el programa de fotógrafos, con el mismo criterio que usa
 * `createReferralEarningsForPaidSale` para generar la comisión.
 */
export async function buscarReferidorActivo(photographerUserId: number): Promise<number | null> {
  const attribution = await prisma.referralAttribution.findFirst({
    where: {
      referredUserId: photographerUserId,
      // Literal y no el enum: así la ruta de pedidos no carga el módulo de referidos.
      referralProgram: "PHOTOGRAPHER_REFERRAL",
      status: "ACTIVE",
      endsAt: { gt: new Date() },
      // Como `referrerHasMp` de CLF: sin Mercado Pago vinculado no se le genera comisión.
      referrerUser: { OR: [{ mpUserId: { not: null } }, { mpConnectedAt: { not: null } }] },
    },
    select: { referrerUserId: true },
  });
  return attribution?.referrerUserId ?? null;
}
