/**
 * Procesa la cola de envíos de campañas de email marketing.
 * Ejecutar vía cron o API cada 1 min (o 30s).
 */

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { renderTemplate } from "./render-template";

const RATE_LIMIT_PER_RUN = parseInt(process.env.EMAIL_CAMPAIGN_RATE_LIMIT ?? "15", 10); // emails por ejecución
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";

export async function processCampaignEmailQueue() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email-campaigns] RESEND_API_KEY no configurada");
    return { processed: 0, errors: [] as string[] };
  }

  const pending = await prisma.emailSend.findMany({
    where: { status: "QUEUED" },
    take: RATE_LIMIT_PER_RUN,
    orderBy: { createdAt: "asc" },
    include: { campaign: true },
  });

  if (pending.length === 0) {
    return { processed: 0, errors: [] };
  }

  const resend = new Resend(apiKey);
  const errors: string[] = [];

  for (const send of pending) {
    const campaign = send.campaign;

    if (campaign.status !== "SENDING") {
      continue;
    }

    const user = send.toUserId
      ? await prisma.user.findUnique({
          where: { id: send.toUserId },
          select: { name: true, email: true, unsubscribeToken: true, companyName: true, role: true, referralCodeOwned: { select: { code: true } } },
        })
      : null;

    const parts = (user?.name ?? "").trim().split(/\s+/);
    const firstName = parts[0] ?? "";
    const lastName = parts.slice(1).join(" ") ?? "";
    const unsubscribeToken = user?.unsubscribeToken;
    const unsubscribeUrl = unsubscribeToken
      ? `${BASE_URL}/unsubscribe?token=${unsubscribeToken}`
      : "#";

    const context = {
      firstName,
      lastName,
      email: send.toEmail,
      workspaceName: user?.companyName ?? "ComprameLaFoto",
      role: user?.role ?? "",
      referralCode: user?.referralCodeOwned?.code ?? "",
      unsubscribeUrl,
    };

    const html = renderTemplate(campaign.html, context);
    const from = `${campaign.fromName} <${campaign.fromEmail}>`;

    try {
      const res = await resend.emails.send({
        from,
        to: send.toEmail,
        subject: campaign.subject,
        html,
      });

      if (res.error) {
        await prisma.emailSend.update({
          where: { id: send.id },
          data: {
            status: "FAILED",
            error: res.error.message,
            attempts: { increment: 1 },
          },
        });
        errors.push(`${send.toEmail}: ${res.error.message}`);
      } else {
        await prisma.emailSend.update({
          where: { id: send.id },
          data: {
            status: "SENT",
            providerMessageId: res.data?.id ?? null,
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.emailSend.update({
        where: { id: send.id },
        data: {
          status: "FAILED",
          error: msg,
          attempts: { increment: 1 },
        },
      });
      errors.push(`${send.toEmail}: ${msg}`);
    }
  }

  await markCampaignSentIfComplete(pending.map((s) => s.campaignId));

  return { processed: pending.length, errors };
}

async function markCampaignSentIfComplete(campaignIds: number[]) {
  const unique = [...new Set(campaignIds)];
  for (const cid of unique) {
    const [queued, sending] = await Promise.all([
      prisma.emailSend.count({ where: { campaignId: cid, status: "QUEUED" } }),
      prisma.emailCampaign.findUnique({ where: { id: cid }, select: { status: true } }),
    ]);

    if (queued === 0 && sending?.status === "SENDING") {
      await prisma.emailCampaign.update({
        where: { id: cid },
        data: { status: "SENT" },
      });
    }
  }
}
