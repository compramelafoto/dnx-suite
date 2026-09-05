import { prisma } from "@repo/db";
import { MARATHON_PACK, MARATHON_PACK_TICKET_CODE } from "@/lib/packs/marathon-pack";
import { debeOfrecerPackDeMaratones } from "@/lib/packs/pack-offer-policy";

/**
 * Garantiza que la edición tenga la entrada Pack 4 a precio fijo.
 * Idempotente — se llama al armar el contexto público de inscripción.
 */
export async function ensureMarathonPackTicket(editionId: string): Promise<string | null> {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { isOpsFixture: true },
  });

  const existing = await prisma.clickatonTicketType.findUnique({
    where: {
      editionId_code: { editionId, code: MARATHON_PACK_TICKET_CODE },
    },
    select: { id: true },
  });
  // Edición oculta de prueba: además de no crearlo, apagar el que haya quedado
  // de una ejecución anterior. Si no, vuelve a aparecer en la próxima visita.
  if (!debeOfrecerPackDeMaratones(edition)) {
    if (existing) {
      await prisma.clickatonTicketType.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
    }
    return null;
  }

  if (existing) {
    await prisma.clickatonTicketType.update({
      where: { id: existing.id },
      data: {
        name: MARATHON_PACK.name,
        description: MARATHON_PACK.description,
        priceAmount: MARATHON_PACK.priceAmountMinor,
        currency: MARATHON_PACK.currency,
        capacity: null,
        holdMinutes: MARATHON_PACK.holdMinutes,
        isActive: true,
        salesStartAt: null,
        salesEndAt: null,
        venueId: null,
      },
    });
    return existing.id;
  }

  const created = await prisma.clickatonTicketType.create({
    data: {
      editionId,
      venueId: null,
      name: MARATHON_PACK.name,
      description: MARATHON_PACK.description,
      code: MARATHON_PACK_TICKET_CODE,
      priceAmount: MARATHON_PACK.priceAmountMinor,
      currency: MARATHON_PACK.currency,
      capacity: null,
      holdMinutes: MARATHON_PACK.holdMinutes,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}
