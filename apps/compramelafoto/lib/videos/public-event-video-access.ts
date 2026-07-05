import type { NextRequest } from "next/server";
import { Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type EventForPublicVideoAccess = {
  id: number;
  creatorId: number;
};

export type EventPublicVideoAccessContext = {
  canBypassExpiresFilter: boolean;
  applyExpiresFilter: boolean;
};

/**
 * Organizador del evento, admin o fotógrafo con álbum en el evento pueden ver videos vencidos (depuración).
 */
export async function resolveEventPublicVideoAccessContext(
  event: EventForPublicVideoAccess
): Promise<EventPublicVideoAccessContext> {
  const authUser = await getAuthUser();

  if (!authUser) {
    return { canBypassExpiresFilter: false, applyExpiresFilter: true };
  }

  if (authUser.role === Role.ADMIN || authUser.id === event.creatorId) {
    return { canBypassExpiresFilter: true, applyExpiresFilter: false };
  }

  const ownsAlbumInEvent = await prisma.album.findFirst({
    where: { eventId: event.id, userId: authUser.id, deletedAt: null },
    select: { id: true },
  });

  const canBypassExpiresFilter = Boolean(ownsAlbumInEvent);
  return {
    canBypassExpiresFilter,
    applyExpiresFilter: !canBypassExpiresFilter,
  };
}

export async function resolveEventPublicVideoAccess(
  _req: NextRequest,
  event: EventForPublicVideoAccess
): Promise<EventPublicVideoAccessContext> {
  return resolveEventPublicVideoAccessContext(event);
}
