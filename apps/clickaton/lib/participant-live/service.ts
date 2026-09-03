import "server-only";

import { prisma } from "@repo/db";
import { getEditionPromptGate } from "@/lib/timeline/prisma-timeline";
import { systemClock, type EditionClock } from "@/lib/timeline/clock";

/**
 * Estado mínimo de la pantalla única del participante ("ya estás participando").
 *
 * Se consulta en cada tick del sondeo desde el teléfono de la persona, así que
 * devuelve lo justo: si la acreditación ya quedó registrada y cuándo se abren
 * las consignas. Sin contenido secreto: el título y las indicaciones viven en
 * la página, que solo los renderiza con el portón abierto.
 */

export type ParticipantLiveActor = {
  id: number;
  email: string;
};

export type ParticipantLiveState = {
  registrationId: string;
  editionId: string;
  editionSlug: string;
  editionName: string;
  timezone: string;
  firstName: string;
  participantNumber: string | null;
  /** Inscripción confirmada y paga (o gratuita). */
  active: boolean;
  accredited: boolean;
  accreditedAt: string | null;
  promptCount: number;
  gate: {
    opensAt: string | null;
    isOpen: boolean;
  };
  serverNow: string;
};

export type ParticipantLiveResult =
  | { ok: true; state: ParticipantLiveState }
  | { ok: false; reason: "NOT_FOUND" };

const DEFAULT_TIMEZONE = "America/Argentina/Cordoba";

export async function loadParticipantLiveState(input: {
  registrationId: string;
  actor: ParticipantLiveActor;
  clock?: EditionClock;
}): Promise<ParticipantLiveResult> {
  const clock = input.clock ?? systemClock();

  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    select: {
      id: true,
      userId: true,
      email: true,
      firstName: true,
      visibleCode: true,
      status: true,
      paymentStatus: true,
      editionId: true,
      edition: { select: { slug: true, name: true, timezone: true } },
      credential: { select: { publicCode: true } },
      checkIns: {
        where: { reversedAt: null },
        orderBy: { checkedInAt: "desc" },
        take: 1,
        select: { checkedInAt: true },
      },
    },
  });

  if (!registration) return { ok: false, reason: "NOT_FOUND" };

  const owns =
    registration.userId === input.actor.id ||
    registration.email.toLowerCase() === input.actor.email.toLowerCase();
  if (!owns) return { ok: false, reason: "NOT_FOUND" };

  const active =
    registration.status === "CONFIRMED" &&
    (registration.paymentStatus === "APPROVED" ||
      registration.paymentStatus === "NOT_REQUIRED");

  const [gate, promptCount] = await Promise.all([
    getEditionPromptGate(registration.editionId, { clock }),
    prisma.clickatonPrompt.count({
      where: { editionId: registration.editionId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    }),
  ]);

  const checkIn = registration.checkIns[0] ?? null;

  return {
    ok: true,
    state: {
      registrationId: registration.id,
      editionId: registration.editionId,
      editionSlug: registration.edition.slug,
      editionName: registration.edition.name,
      timezone: registration.edition.timezone ?? DEFAULT_TIMEZONE,
      firstName: registration.firstName,
      participantNumber: registration.visibleCode ?? registration.credential?.publicCode ?? null,
      active,
      accredited: Boolean(checkIn),
      accreditedAt: checkIn?.checkedInAt.toISOString() ?? null,
      promptCount,
      gate: {
        opensAt: gate.opensAt?.toISOString() ?? null,
        isOpen: gate.isOpen,
      },
      serverNow: clock.now().toISOString(),
    },
  };
}
