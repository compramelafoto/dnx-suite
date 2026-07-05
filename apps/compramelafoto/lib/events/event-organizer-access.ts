import { prisma } from "@/lib/prisma";

/** True si el usuario es el creador (organizador) del evento. */
export async function isEventOrganizerUser(userId: number, eventId: number): Promise<boolean> {
  if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(eventId) || eventId <= 0) {
    return false;
  }
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { creatorId: true },
  });
  return event?.creatorId === userId;
}
