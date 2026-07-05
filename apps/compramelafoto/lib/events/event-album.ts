import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { encodeGeohash } from "@/lib/geo";
import { eventPhotographerAlbumVisibilityForEventJoin } from "@/lib/events/event-photographer-album-visibility";

type EventAlbumParams = {
  event: {
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
  };
  user: { id: number; name: string | null };
  enforceUploadsGate?: boolean;
};

export async function getOrCreateEventAlbumForUser({
  event,
  user,
  enforceUploadsGate = false,
}: EventAlbumParams) {
  const existing = await prisma.album.findFirst({
    where: { eventId: event.id, userId: user.id, deletedAt: null },
    select: { id: true, publicSlug: true },
  });
  if (existing) return existing;

  const now = new Date();
  const ended = event.endsAt ? event.endsAt < now : event.startsAt < now;
  if (enforceUploadsGate && !event.uploadsEnabled && !ended) {
    return null;
  }

  const title = event.title;
  let publicSlug: string;
  let attempts = 0;
  do {
    const randomString = crypto.randomBytes(4).toString("hex");
    publicSlug = `${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${randomString}`;
    attempts++;
    if (attempts > 10) {
      publicSlug = crypto.randomUUID();
      break;
    }
  } while (await prisma.album.findUnique({ where: { publicSlug } }));

  const geohash =
    event.latitude != null && event.longitude != null
      ? encodeGeohash(event.latitude, event.longitude)
      : null;

  const albumVisibility = eventPhotographerAlbumVisibilityForEventJoin();

  return prisma.album.create({
    data: {
      userId: user.id,
      creatorId: user.id,
      eventId: event.id,
      title,
      location: event.locationName || event.city || event.title,
      eventDate: event.startsAt,
      publicSlug,
      type: event.type as any,
      latitude: event.latitude,
      longitude: event.longitude,
      geohash,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      city: event.city,
      isPublic: albumVisibility.isPublic,
      isHidden: albumVisibility.isHidden,
      showComingSoonMessage: true,
    },
    select: { id: true, publicSlug: true },
  });
}

export async function ensureEventAlbumTitles(eventId: number, title: string) {
  await prisma.album.updateMany({
    where: {
      eventId,
      deletedAt: null,
      title: { not: title },
    },
    data: { title },
  });
}
