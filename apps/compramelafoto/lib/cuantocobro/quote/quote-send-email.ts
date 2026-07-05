import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMessageHtml(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export type SendQuoteDeliveryEmailInput = {
  to: string;
  subject: string;
  message: string;
  publicUrl: string | null;
  businessName?: string;
  replyTo?: string;
  pdfAttachment?: { filename: string; content: Uint8Array };
  userId: number;
};

export async function sendQuoteDeliveryEmail(
  input: SendQuoteDeliveryEmailInput,
): Promise<{ success: boolean; error?: string; resendId?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  if (!resendKey || !fromEmail) {
    return { success: false, error: "El envío de emails no está configurado" };
  }

  const resend = new Resend(resendKey);
  const senderName = input.businessName?.trim() || "¿Cuánto Cobro?";
  const messageHtml = formatMessageHtml(input.message);
  const linkBlock = input.publicUrl
    ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(input.publicUrl)}" style="color:#c27b3d;font-weight:600;">Ver presupuesto online</a></p>`
    : "";

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;max-width:560px;">
      ${messageHtml || `<p style="margin:0 0 12px;">Te comparto el presupuesto fotográfico.</p>`}
      ${linkBlock}
      <p style="margin:24px 0 0;font-size:12px;color:#666;">Enviado con ¿Cuánto Cobro? · ComprameLaFoto</p>
    </div>
  `.trim();

  const replyTo = input.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined;

  let resendId: string | undefined;
  try {
    const response = await resend.emails.send({
      from: `${senderName} <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html,
      replyTo,
      attachments: input.pdfAttachment
        ? [
            {
              filename: input.pdfAttachment.filename,
              content: Buffer.from(input.pdfAttachment.content),
            },
          ]
        : undefined,
    });

    resendId = response?.data?.id;

    await prisma.sentEmailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        templateKey: "ADMIN_MANUAL",
        resendId: resendId ?? null,
        status: "SENT",
        error: null,
        userId: input.userId,
      },
    });

    return { success: true, resendId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await prisma.sentEmailLog.create({
      data: {
        to: input.to,
        subject: input.subject,
        templateKey: "ADMIN_MANUAL",
        resendId: resendId ?? null,
        status: "FAILED",
        error: errorMessage,
        userId: input.userId,
      },
    });
    return { success: false, error: errorMessage };
  }
}
