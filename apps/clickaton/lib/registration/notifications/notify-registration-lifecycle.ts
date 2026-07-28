import { prisma } from "@repo/db";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";
import {
  enqueueAndSendIdempotentEmail,
  paymentConfirmationIdempotencyKey,
  PAYMENT_CONFIRMATION_TEMPLATE_KEY,
} from "@/lib/registration/notifications/email-delivery";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";

/**
 * Best-effort payment-confirmed email after accredited confirm.
 * Never throws to the payment path; durable via EmailQueue idempotency key.
 * Payment remains PAID/CONFIRMED even if Resend fails (retry via queue).
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
        paymentStatus: true,
        visibleCode: true,
        instagramHandle: true,
        edition: { select: { name: true, slug: true, startAt: true } },
        items: {
          where: { isIncluded: true },
          select: {
            nameSnapshot: true,
            variantNameSnapshot: true,
          },
        },
      },
    });
    if (!row || row.status !== "CONFIRMED") return;

    const accessToken = signRegistrationAccessToken({
      registrationId: row.id,
      editionSlug: input.editionSlug || row.edition.slug,
      expiresAtMs: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    const includedItemLabels = row.items.map((i) =>
      i.variantNameSnapshot
        ? `${i.nameSnapshot} — ${i.variantNameSnapshot}`
        : i.nameSnapshot,
    );

    const built = await sendParticipantFunnelEmail({
      kind: "payment_confirmed",
      to: row.email,
      participantName: row.firstName,
      editionName: row.edition.name,
      editionSlug: row.edition.slug,
      registrationId: row.id,
      accessToken,
      city: row.city,
      startAt: row.edition.startAt,
      includedItemLabels,
      visibleCode: row.visibleCode,
      instagramHandle: row.instagramHandle,
      paymentStatus: row.paymentStatus,
      dryRunBuildOnly: true,
    });

    const delivery = await enqueueAndSendIdempotentEmail({
      idempotencyKey: paymentConfirmationIdempotencyKey(row.id),
      to: built.deliveredTo,
      subject: built.subject,
      text: built.text,
      html: built.html,
      templateKey: PAYMENT_CONFIRMATION_TEMPLATE_KEY,
      templateData: {
        registrationId: row.id,
        source: input.source,
        visibleCode: row.visibleCode,
      },
    });

    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId: row.id,
        action:
          delivery.status === "SENT" || delivery.status === "ALREADY_SENT"
            ? "EMAIL_SENT"
            : "EMAIL_QUEUED",
        source: input.source,
        metadata: {
          kind: "payment_confirmed",
          deliveryStatus: delivery.status,
          emailQueueId: delivery.emailQueueId,
          reason: delivery.reason?.slice(0, 120),
          idempotent: delivery.status === "ALREADY_SENT",
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
