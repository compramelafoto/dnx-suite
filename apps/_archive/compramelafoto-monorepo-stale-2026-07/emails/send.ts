import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import type { SendEmailParams } from "./types";

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} no está configurado`);
  }
  return value;
}

function resolveReplyTo(explicitReplyTo?: string) {
  const envReplyTo = process.env.EMAIL_REPLY_TO;
  if (explicitReplyTo) return explicitReplyTo;
  if (envReplyTo && envReplyTo.trim()) return envReplyTo.trim();
  return undefined;
}

export async function sendEmail(params: SendEmailParams) {
  const { to, subject, html, replyTo, templateKey, meta } = params;
  const resendKey = getEnvOrThrow("RESEND_API_KEY");
  const fromEmail = getEnvOrThrow("EMAIL_FROM");
  const resend = new Resend(resendKey);

  let resendId: string | undefined;
  try {
    const response = await resend.emails.send({
      from: `Compramelafoto <${fromEmail}>`,
      to,
      subject,
      html,
      replyTo: resolveReplyTo(replyTo),
    });

    resendId = response?.data?.id;

    await prisma.sentEmailLog.create({
      data: {
        to,
        subject,
        templateKey: templateKey || "ADMIN_MANUAL",
        resendId: resendId ?? null,
        status: "SENT",
        error: null,
        userId: meta?.userId ?? null,
        albumId: meta?.albumId ?? null,
      },
    });

    return { success: true, resendId };
  } catch (error: any) {
    const errorMessage = String(error?.message ?? error);
    await prisma.sentEmailLog.create({
      data: {
        to,
        subject,
        templateKey: templateKey || "ADMIN_MANUAL",
        resendId: resendId ?? null,
        status: "FAILED",
        error: errorMessage,
        userId: meta?.userId ?? null,
        albumId: meta?.albumId ?? null,
      },
    });

    await prisma.adminSystemMessage.create({
      data: {
        type: "EMAIL_ERROR",
        title: "Error enviando email",
        body: `Para: ${to}\nAsunto: ${subject}\nError: ${errorMessage}`,
      },
    });

    return { success: false, error: errorMessage };
  }
}
