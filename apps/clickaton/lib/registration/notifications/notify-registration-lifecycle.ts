import { prisma } from "@repo/db";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";

/**
 * Best-effort payment-confirmed email after accredited confirm.
 * Never throws to the payment path; audits outcome when possible.
 */
export async function notifyPaidRegistrationConfirmed(input: {
  registrationId: string;
  editionSlug: string;
  source: string;
}): Promise<void> {
  try {
    const row = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        city: true,
        status: true,
        edition: { select: { name: true, slug: true, startAt: true } },
      },
    });
    if (!row || row.status !== "CONFIRMED") return;

    const accessToken = signRegistrationAccessToken({
      registrationId: row.id,
      editionSlug: input.editionSlug || row.edition.slug,
      expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const emailResult = await sendParticipantFunnelEmail({
      kind: "payment_confirmed",
      to: row.email,
      participantName: row.firstName,
      editionName: row.edition.name,
      editionSlug: row.edition.slug,
      registrationId: row.id,
      accessToken,
      city: row.city,
      startAt: row.edition.startAt,
    });

    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId: row.id,
        action: emailResult.sent ? "EMAIL_SENT" : "EMAIL_QUEUED",
        source: input.source,
        metadata: {
          kind: "payment_confirmed",
          skipped: emailResult.skipped,
          reason: emailResult.reason?.slice(0, 120),
        },
      },
    });
  } catch {
    // Non-blocking: fulfillment already committed.
  }
}

export async function notifyHoldExpired(input: {
  registrationId: string;
  source?: string;
}): Promise<void> {
  try {
    const row = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        status: true,
        edition: { select: { name: true, slug: true } },
      },
    });
    // Hold expiry maps registration → CANCELLED + payment EXPIRED (canonical).
    if (!row || row.status !== "CANCELLED") return;

    const emailResult = await sendParticipantFunnelEmail({
      kind: "hold_expired",
      to: row.email,
      participantName: row.firstName,
      editionName: row.edition.name,
      editionSlug: row.edition.slug,
      registrationId: row.id,
    });

    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId: row.id,
        action: emailResult.sent ? "EMAIL_SENT" : "EMAIL_QUEUED",
        source: input.source ?? "hold_expiry_cron",
        metadata: {
          kind: "hold_expired",
          skipped: emailResult.skipped,
          reason: emailResult.reason?.slice(0, 120),
        },
      },
    });
  } catch {
    // Non-blocking
  }
}
