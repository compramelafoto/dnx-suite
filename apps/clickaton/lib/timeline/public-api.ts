import { prisma } from "@/lib/admin/db";
import type { EditionClock } from "./clock";
import { systemClock } from "./clock";
import {
  getEditionTemporalState,
  listPromptPublicDtos,
} from "./prisma-timeline";

export async function resolveEditionIdBySlug(slug: string): Promise<{
  id: string;
  slug: string;
  timezone: string | null;
} | null> {
  return prisma.clickatonEdition.findUnique({
    where: { slug },
    select: { id: true, slug: true, timezone: true },
  });
}

export async function getPublicTimelineBySlug(
  slug: string,
  clock: EditionClock = systemClock(),
) {
  const edition = await resolveEditionIdBySlug(slug);
  if (!edition) return null;
  const state = await getEditionTemporalState(edition.id, clock);
  return {
    editionSlug: edition.slug,
    ...state,
  };
}

export async function getPublicPromptsBySlug(
  slug: string,
  options?: { clock?: EditionClock; participantPaid?: boolean },
) {
  const edition = await resolveEditionIdBySlug(slug);
  if (!edition) return null;
  const prompts = await listPromptPublicDtos(edition.id, options);
  return {
    editionSlug: edition.slug,
    serverNow: (options?.clock ?? systemClock()).now().toISOString(),
    prompts,
  };
}

export async function getServerNowBySlug(slug: string, clock: EditionClock = systemClock()) {
  const edition = await resolveEditionIdBySlug(slug);
  if (!edition) return null;
  return {
    editionSlug: edition.slug,
    timezone: edition.timezone ?? "America/Argentina/Cordoba",
    serverNow: clock.now().toISOString(),
  };
}

/** Participante PAID/CONFIRMED de la edición (para contenido privado). */
export async function isPaidParticipantForEdition(input: {
  editionId: string;
  userId?: number | null;
  email?: string | null;
}): Promise<boolean> {
  if (!input.userId && !input.email) return false;
  const reg = await prisma.clickatonRegistration.findFirst({
    where: {
      editionId: input.editionId,
      status: "CONFIRMED",
      paymentStatus: { in: ["APPROVED", "NOT_REQUIRED"] },
      OR: [
        ...(input.userId ? [{ userId: input.userId }] : []),
        ...(input.email
          ? [{ email: { equals: input.email, mode: "insensitive" as const } }]
          : []),
      ],
    },
    select: { id: true },
  });
  return Boolean(reg);
}
