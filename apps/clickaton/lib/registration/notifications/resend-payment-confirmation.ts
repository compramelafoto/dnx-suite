/**
 * Reenvío seguro de email de confirmación post-pago.
 * No regenera QR/credencial/registration. Rate-limited + audit.
 */
import { prisma } from "@repo/db";
import { verifyRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { sendParticipantFunnelEmail } from "./participant-email";
import { enqueueAndSendIdempotentEmail } from "./email-delivery";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";

const WINDOW_MS = 15 * 60_000;
const MAX_RESENDS_PER_WINDOW = 3;

export type ResendConfirmationResult = {
  ok: boolean;
  code:
    | "SENT"
    | "RATE_LIMITED"
    | "NOT_CONFIRMED"
    | "FORBIDDEN"
    | "FAILED"
    | "UNEXPECTED";
  message: string;
  deliveredToMasked?: string;
};

function maskEmail(email: string): string {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

export async function resendPaymentConfirmationEmail(input: {
  registrationId: string;
  accessToken: string;
  editionSlug: string;
  actor?: "participant" | "admin";
  adminUserId?: number;
}): Promise<ResendConfirmationResult> {
  try {
    const token = verifyRegistrationAccessToken({
      registrationId: input.registrationId,
      editionSlug: input.editionSlug,
      token: input.accessToken,
    });
    if (!token.ok) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "No pudimos reenviarlo. Tu inscripción sigue confirmada.",
      };
    }

    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: input.registrationId },
      include: {
        edition: true,
        items: {
          where: { isIncluded: true },
          select: { nameSnapshot: true, variantNameSnapshot: true },
        },
      },
    });
    if (!reg || reg.status !== "CONFIRMED") {
      return {
        ok: false,
        code: "NOT_CONFIRMED",
        message: "La inscripción no está confirmada todavía.",
      };
    }

    const since = new Date(Date.now() - WINDOW_MS);
    const recent = await prisma.clickatonRegistrationAudit.count({
      where: {
        registrationId: reg.id,
        action: "EMAIL_RESEND",
        createdAt: { gte: since },
      },
    });
    if (recent >= MAX_RESENDS_PER_WINDOW) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        message:
          "Ya reenviamos el correo varias veces. Esperá unos minutos e intentá de nuevo. Tu inscripción sigue confirmada.",
      };
    }

    const accessToken = signRegistrationAccessToken({
      registrationId: reg.id,
      editionSlug: reg.edition.slug,
      expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 30,
    });
    const built = await sendParticipantFunnelEmail({
      kind: "payment_confirmed",
      to: reg.email,
      participantName: `${reg.firstName} ${reg.lastName}`.trim(),
      editionName: reg.edition.name,
      editionSlug: reg.edition.slug,
      registrationId: reg.id,
      accessToken,
      amountLabel: formatPublicPrice(reg.totalAmount, reg.currency as "ARS"),
      city: reg.city ?? reg.edition.city,
      startAt: reg.edition.startAt,
      includedItemLabels: reg.items.map((i) =>
        [i.nameSnapshot, i.variantNameSnapshot].filter(Boolean).join(" · "),
      ),
      visibleCode: reg.visibleCode,
      instagramHandle: reg.instagramHandle,
      paymentStatus: reg.paymentStatus,
      dryRunBuildOnly: true,
    });

    const resendKey = `${reg.id}:CLICKATON_PAYMENT_CONFIRMATION:resend:${Date.now()}`;
    const delivery = await enqueueAndSendIdempotentEmail({
      idempotencyKey: resendKey,
      to: built.deliveredTo,
      subject: built.subject,
      text: built.text,
      html: built.html,
      templateKey: "CLICKATON_PAYMENT_CONFIRMATION",
      templateData: {
        kind: "payment_confirmed",
        resend: true,
        actor: input.actor ?? "participant",
      },
    });

    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId: reg.id,
        action: "EMAIL_RESEND",
        source:
          input.actor === "admin"
            ? "admin_resend_confirmation"
            : "participant_resend_confirmation",
        actorUserId: input.adminUserId ?? null,
        metadata: {
          emailQueueId: delivery.emailQueueId,
          deliveryStatus: delivery.status,
          providerMessageId: delivery.providerMessageId ?? null,
          toMasked: maskEmail(built.deliveredTo),
        },
      },
    });

    if (delivery.status === "SENT" || delivery.status === "ALREADY_SENT") {
      return {
        ok: true,
        code: "SENT",
        message: "Correo reenviado",
        deliveredToMasked: maskEmail(built.deliveredTo),
      };
    }

    return {
      ok: false,
      code: "FAILED",
      message: "No pudimos reenviarlo. Tu inscripción sigue confirmada.",
      deliveredToMasked: maskEmail(built.deliveredTo),
    };
  } catch {
    return {
      ok: false,
      code: "UNEXPECTED",
      message: "No pudimos reenviarlo. Tu inscripción sigue confirmada.",
    };
  }
}
