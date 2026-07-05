import {
  EventJoinPolicy,
  EventMemberRole,
  EventMemberStatus,
  Role,
} from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getOrCreateEventAlbumForUser } from "@/lib/events/event-album";
import { eventPhotographerAlbumVisibilityForEventJoin } from "@/lib/events/event-photographer-album-visibility";
import { resolveEventPhotographerTerms } from "@/lib/events/terms";
import type { OrganizerEventForAlbum } from "@/lib/organizer-event-access";

export type EnrollPhotographerOutcome = "enrolled" | "reactivated" | "already_active";

export type EnrollPhotographerResult =
  | {
      ok: true;
      outcome: EnrollPhotographerOutcome;
      memberId: number;
      albumId: number | null;
      publicSlug: string | null;
    }
  | { ok: false; status: number; message: string };

const ORGANIZER_ENROLL_JOIN_POLICIES: EventJoinPolicy[] = [
  EventJoinPolicy.OPEN,
  EventJoinPolicy.REQUEST,
];

function organizerEnrollTermsNote(): string {
  return " [Inscripto por el organizador del evento]";
}

export async function enrollPhotographerInEvent(params: {
  event: OrganizerEventForAlbum;
  userId: number;
  byOrganizer?: boolean;
}): Promise<EnrollPhotographerResult> {
  const { event, userId, byOrganizer = false } = params;

  if (byOrganizer && !ORGANIZER_ENROLL_JOIN_POLICIES.includes(event.joinPolicy)) {
    return {
      ok: false,
      status: 400,
      message:
        "En eventos solo por invitación usá la lista de invitados. Los fotógrafos invitados pueden inscribirse con el link del evento.",
    };
  }

  const photographer = await prisma.user.findFirst({
    where: {
      id: userId,
      role: { in: [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER] },
      isBlocked: false,
    },
    select: { id: true, name: true, email: true },
  });

  if (!photographer) {
    return {
      ok: false,
      status: 404,
      message: "No encontramos un fotógrafo activo con ese usuario.",
    };
  }

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: photographer.id } },
  });

  if (existing?.status === EventMemberStatus.ACTIVE) {
    const album = await getOrCreateEventAlbumForUser({
      event,
      user: { id: photographer.id, name: photographer.name ?? null },
    });
    if (album?.id) {
      await prisma.album.update({
        where: { id: album.id },
        data: eventPhotographerAlbumVisibilityForEventJoin(),
      });
    }
    return {
      ok: true,
      outcome: "already_active",
      memberId: existing.id,
      albumId: album?.id ?? null,
      publicSlug: album?.publicSlug ?? null,
    };
  }

  if (existing?.status === EventMemberStatus.PENDING && !byOrganizer) {
    return {
      ok: false,
      status: 409,
      message: "El fotógrafo ya tiene una solicitud pendiente de aprobación.",
    };
  }

  const activePhotographersCount = await prisma.eventMember.count({
    where: {
      eventId: event.id,
      role: EventMemberRole.PHOTOGRAPHER,
      status: EventMemberStatus.ACTIVE,
    },
  });

  const max = event.maxPhotographers ?? null;
  if (max !== null && activePhotographersCount >= max) {
    return {
      ok: false,
      status: 400,
      message:
        "El cupo máximo de fotógrafos ya está completo. Aumentá el cupo antes de inscribir a alguien más.",
    };
  }

  const termsText =
    resolveEventPhotographerTerms(event) + (byOrganizer ? organizerEnrollTermsNote() : "");

  let memberId: number;

  if (existing) {
    const updated = await prisma.eventMember.update({
      where: { id: existing.id },
      data: {
        status: EventMemberStatus.ACTIVE,
        termsAcceptedAt: new Date(),
        termsAcceptedText: termsText,
      },
    });
    memberId = updated.id;
  } else {
    const created = await prisma.eventMember.create({
      data: {
        eventId: event.id,
        userId: photographer.id,
        role: EventMemberRole.PHOTOGRAPHER,
        status: EventMemberStatus.ACTIVE,
        termsAcceptedAt: new Date(),
        termsAcceptedText: termsText,
      },
    });
    memberId = created.id;
  }

  const album = await getOrCreateEventAlbumForUser({
    event,
    user: { id: photographer.id, name: photographer.name ?? null },
  });

  if (album?.id) {
    await prisma.album.update({
      where: { id: album.id },
      data: eventPhotographerAlbumVisibilityForEventJoin(),
    });
  }

  return {
    ok: true,
    outcome: existing ? "reactivated" : "enrolled",
    memberId,
    albumId: album?.id ?? null,
    publicSlug: album?.publicSlug ?? null,
  };
}
