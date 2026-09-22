import "server-only";

/**
 * Crear y mandar las invitaciones a testimoniar de una edición.
 *
 * Participantes confirmados y contactos de sede. Los jurados no entran acá:
 * su padrón vive en la base de FotoRank y la cantidad de fichas espejo depende
 * de configuración que puede faltar. Prometer un correo que no sale es peor que
 * no prometerlo — se invitan a mano desde el panel.
 */
import { prisma } from "@repo/db";
import { sendTestimonialInviteEmail } from "../notifications/testimonial-invite-email";
import { canInviteEdition } from "./invite-selection";
import type { ClickatonTestimonialAuthorRole } from "../domain/types";

export type InviteOutcome = {
  created: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Quedaron para la corrida siguiente por el tope de envíos. */
  remaining: number;
};

type Recipient = {
  email: string;
  firstName: string | null;
  authorRole: ClickatonTestimonialAuthorRole;
  registrationId: string | null;
  venueId: string | null;
  userId: number | null;
};

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim().toLowerCase();
  return trimmed.includes("@") ? trimmed : null;
}

async function collectRecipients(editionId: string): Promise<Recipient[]> {
  const [registrations, venues] = await Promise.all([
    prisma.clickatonRegistration.findMany({
      where: { editionId, status: "CONFIRMED", isOpsTest: false },
      select: { id: true, email: true, firstName: true, userId: true },
    }),
    prisma.clickatonVenue.findMany({
      where: { editionId, isActive: true, contactEmail: { not: null } },
      select: { id: true, contactEmail: true, contactName: true },
    }),
  ]);

  const byEmail = new Map<string, Recipient>();

  for (const registration of registrations) {
    const email = normalizeEmail(registration.email);
    if (!email) continue;
    // El participante gana si el mismo correo aparece también como sede.
    byEmail.set(email, {
      email,
      firstName: registration.firstName,
      authorRole: "PARTICIPANT",
      registrationId: registration.id,
      venueId: null,
      userId: registration.userId,
    });
  }

  for (const venue of venues) {
    const email = normalizeEmail(venue.contactEmail);
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      firstName: venue.contactName,
      authorRole: "VENUE",
      registrationId: null,
      venueId: venue.id,
      userId: null,
    });
  }

  return [...byEmail.values()];
}

/**
 * Tope de envíos por corrida.
 *
 * Cada correo es una ida y vuelta a Resend dentro de una función con límite de
 * tiempo. Sin tope, una edición con muchos inscriptos corta a la mitad y no se
 * sabe dónde quedó. Con tope, la corrida siguiente sigue donde dejó: la clave
 * única por edición y correo hace que nadie reciba dos veces.
 */
export const INVITES_PER_RUN = 40;

export async function inviteTestimonials(options: {
  editionId: string;
  /** Para invitar a una sola inscripción desde su ficha. */
  onlyRegistrationId?: string;
  /** Cuántos mandar como mucho en esta corrida. */
  limit?: number;
}): Promise<InviteOutcome> {
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: options.editionId },
    select: {
      id: true,
      name: true,
      slug: true,
      testimonialsEnabled: true,
      isOpsFixture: true,
    },
  });

  if (
    !edition ||
    !canInviteEdition(edition, { single: Boolean(options.onlyRegistrationId) })
  ) {
    return { created: 0, sent: 0, skipped: 0, failed: 0, remaining: 0 };
  }

  const all = await collectRecipients(edition.id);
  const recipients = options.onlyRegistrationId
    ? all.filter((r) => r.registrationId === options.onlyRegistrationId)
    : all;

  const outcome: InviteOutcome = {
    created: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    remaining: 0,
  };
  const limit = Math.max(1, options.limit ?? INVITES_PER_RUN);
  let attempted = 0;

  for (const recipient of recipients) {
    // Lo ya invitado no gasta cupo: el tope cuenta envíos, no vueltas del bucle.
    if (attempted >= limit) {
      outcome.remaining += 1;
      continue;
    }
    // La clave única [editionId, email] es la que evita el doble envío, no una
    // comprobación previa que podría correr dos veces a la vez.
    const existing = await prisma.clickatonTestimonialInvite.findUnique({
      where: {
        editionId_email: { editionId: edition.id, email: recipient.email },
      },
      select: { id: true, status: true },
    });

    if (existing && existing.status !== "PENDING" && existing.status !== "FAILED") {
      outcome.skipped += 1;
      continue;
    }

    const invite =
      existing ??
      (await prisma.clickatonTestimonialInvite.create({
        data: {
          editionId: edition.id,
          authorRole: recipient.authorRole,
          email: recipient.email,
          userId: recipient.userId,
          registrationId: recipient.registrationId,
          venueId: recipient.venueId,
          idempotencyKey: `${edition.id}:${recipient.email}`,
        },
        select: { id: true, status: true },
      }));

    if (!existing) outcome.created += 1;
    attempted += 1;

    try {
      const delivery = await sendTestimonialInviteEmail({
        inviteId: invite.id,
        to: recipient.email,
        firstName: recipient.firstName,
        editionName: edition.name,
        editionSlug: edition.slug,
      });

      const delivered =
        delivery.status === "SENT" || delivery.status === "ALREADY_SENT";

      await prisma.clickatonTestimonialInvite.update({
        where: { id: invite.id },
        data: {
          status: delivered ? "SENT" : "FAILED",
          ...(delivered ? { sentAt: new Date() } : {}),
          emailQueueId: delivery.emailQueueId,
        },
      });

      if (delivered) outcome.sent += 1;
      else outcome.failed += 1;
    } catch (error) {
      console.error("[clickaton] invitación a testimoniar falló:", error);
      await prisma.clickatonTestimonialInvite.update({
        where: { id: invite.id },
        data: { status: "FAILED" },
      });
      outcome.failed += 1;
    }
  }

  return outcome;
}
