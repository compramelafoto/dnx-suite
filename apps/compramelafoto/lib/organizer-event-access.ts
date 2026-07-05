import { prisma } from "@/lib/prisma";
import type { EventJoinPolicy } from "@prisma/client";

/** Campos mínimos del Event para getOrCreateEventAlbumForUser */
export type OrganizerEventForAlbum = {
  id: number;
  title: string;
  locationName: string | null;
  city: string;
  startsAt: Date;
  endsAt: Date | null;
  type: string;
  latitude: number;
  longitude: number;
  uploadsEnabled: boolean;
  joinPolicy: EventJoinPolicy;
  photographerTerms: string | null;
  maxPhotographers: number | null;
};

export async function assertOrganizerOwnsEvent(
  eventId: number,
  organizerUserId: number
): Promise<
  | { ok: true; event: OrganizerEventForAlbum }
  | { ok: false; status: number; message: string }
> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      creatorId: true,
      maxPhotographers: true,
      title: true,
      locationName: true,
      city: true,
      startsAt: true,
      endsAt: true,
      type: true,
      latitude: true,
      longitude: true,
      uploadsEnabled: true,
      joinPolicy: true,
      photographerTerms: true,
    },
  });
  if (!event) {
    return { ok: false, status: 404, message: "Evento no encontrado" };
  }
  if (event.creatorId !== organizerUserId) {
    return { ok: false, status: 403, message: "No podés gestionar este evento" };
  }
  return { ok: true, event };
}
