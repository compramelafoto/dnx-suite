import { prisma } from "@repo/db";
import { sendGiftEmail } from "./gift-email";

/**
 * Avisos del regalo. Nunca revierten el pago ni el canje: si el correo falla,
 * se registra y sigue, igual que en el resto del funnel.
 */

function formatEditionDate(value: Date | null): string | null {
  if (!value) return null;
  return value.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba",
  });
}

/** Pago acreditado: le avisamos a quien regala y, si dejó email, al amigo. */
export async function notifyGiftPurchased(registrationId: string): Promise<void> {
  try {
    const voucher = await prisma.clickatonGiftVoucher.findUnique({
      where: { registrationId },
      select: {
        code: true,
        buyerFirstName: true,
        buyerEmail: true,
        recipientName: true,
        recipientEmail: true,
        giftMessage: true,
        edition: { select: { name: true, startAt: true } },
      },
    });
    if (!voucher) return;

    const editionDate = formatEditionDate(voucher.edition.startAt);
    const common = {
      buyerName: voucher.buyerFirstName,
      recipientName: voucher.recipientName,
      editionName: voucher.edition.name,
      voucherCode: voucher.code,
      editionDate,
    };

    await sendGiftEmail({
      ...common,
      kind: "gift_purchased_buyer",
      to: voucher.buyerEmail,
    });

    if (voucher.recipientEmail) {
      await sendGiftEmail({
        ...common,
        kind: "gift_invitation_recipient",
        to: voucher.recipientEmail,
        giftMessage: voucher.giftMessage,
      });
      await prisma.clickatonGiftVoucher.update({
        where: { registrationId },
        data: {
          recipientEmailSentAt: new Date(),
          recipientEmailCount: { increment: 1 },
        },
      });
    }
  } catch (error) {
    console.error("[clickaton] notifyGiftPurchased falló:", error);
  }
}

/** Alguien activó el regalo: se lo contamos a quien lo hizo. */
export async function notifyGiftRedeemed(registrationId: string): Promise<void> {
  try {
    const voucher = await prisma.clickatonGiftVoucher.findUnique({
      where: { registrationId },
      select: {
        code: true,
        buyerFirstName: true,
        buyerEmail: true,
        recipientName: true,
        edition: { select: { name: true, startAt: true } },
        registration: { select: { firstName: true, lastName: true } },
      },
    });
    if (!voucher) return;

    await sendGiftEmail({
      kind: "gift_redeemed_buyer",
      to: voucher.buyerEmail,
      buyerName: voucher.buyerFirstName,
      recipientName: voucher.recipientName,
      editionName: voucher.edition.name,
      voucherCode: voucher.code,
      editionDate: formatEditionDate(voucher.edition.startAt),
      redeemedByName:
        `${voucher.registration.firstName} ${voucher.registration.lastName}`.trim(),
    });
  } catch (error) {
    console.error("[clickaton] notifyGiftRedeemed falló:", error);
  }
}

/** Reenvío manual del voucher al amigo, con tope para cortar abuso. */
export const GIFT_RECIPIENT_EMAIL_MAX_SENDS = 5;

export async function resendGiftInvitation(input: {
  registrationId: string;
  /** Si viene, reemplaza el email del destinatario antes de enviar. */
  newRecipientEmail?: string | null;
}): Promise<{ ok: boolean; reason?: string }> {
  const voucher = await prisma.clickatonGiftVoucher.findUnique({
    where: { registrationId: input.registrationId },
    select: {
      code: true,
      status: true,
      buyerFirstName: true,
      recipientName: true,
      recipientEmail: true,
      giftMessage: true,
      recipientEmailCount: true,
      edition: { select: { name: true, startAt: true } },
    },
  });
  if (!voucher) return { ok: false, reason: "NOT_FOUND" };
  if (voucher.status !== "ACTIVE") return { ok: false, reason: "NOT_ACTIVE" };
  if (voucher.recipientEmailCount >= GIFT_RECIPIENT_EMAIL_MAX_SENDS) {
    return { ok: false, reason: "TOO_MANY_SENDS" };
  }

  const to = input.newRecipientEmail?.trim().toLowerCase() || voucher.recipientEmail;
  if (!to) return { ok: false, reason: "NO_RECIPIENT_EMAIL" };

  await sendGiftEmail({
    kind: "gift_invitation_recipient",
    to,
    buyerName: voucher.buyerFirstName,
    recipientName: voucher.recipientName,
    editionName: voucher.edition.name,
    voucherCode: voucher.code,
    editionDate: formatEditionDate(voucher.edition.startAt),
    giftMessage: voucher.giftMessage,
  });

  await prisma.clickatonGiftVoucher.update({
    where: { registrationId: input.registrationId },
    data: {
      recipientEmail: to,
      recipientEmailSentAt: new Date(),
      recipientEmailCount: { increment: 1 },
    },
  });

  return { ok: true };
}
