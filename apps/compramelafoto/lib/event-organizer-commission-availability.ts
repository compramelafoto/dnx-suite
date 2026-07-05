import { EventOrganizerCommissionStatus } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const LOG_PREFIX = "[event-organizer-commission]";

/**
 * Pasa a AVAILABLE las comisiones de organizador de evento que ya cumplieron la fecha
 * (snapshot crea PENDING + availableAt = confirmación de pago + 15 días).
 */
export async function markDueEventOrganizerCommissionsAsAvailable(): Promise<number> {
  const now = new Date();

  const result = await prisma.eventOrganizerCommission.updateMany({
    where: {
      status: EventOrganizerCommissionStatus.PENDING,
      availableAt: { lte: now },
    },
    data: {
      status: EventOrganizerCommissionStatus.AVAILABLE,
    },
  });

  const updatedCount = result.count;
  if (updatedCount > 0) {
    console.info(`${LOG_PREFIX} marked_available`, {
      updatedCount,
      at: now.toISOString(),
    });
  }

  return updatedCount;
}
