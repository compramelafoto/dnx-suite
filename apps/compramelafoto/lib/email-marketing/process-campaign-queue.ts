/**
 * Procesa la cola de envíos de campañas de email marketing.
 * Ejecutar vía cron o API cada 1 min (o 30s).
 */

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { renderTemplate } from "./render-template";

const RATE_LIMIT_PER_RUN = parseInt(process.env.EMAIL_CAMPAIGN_RATE_LIMIT ?? "15", 10); // emails por ejecución
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";
/** 8 envíos por segundo: deja margen bajo el tope de 10/s de Resend. */
const PAUSA_ENTRE_ENVIOS_MS = 125;

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

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

    // Resend acepta 10 envíos por segundo. Sin esta pausa la tanda sale de
    // golpe y el proveedor rechaza el sobrante con "Too many requests", que
    // se registra como envío fallido aunque el correo esté perfecto.
    await esperar(PAUSA_ENTRE_ENVIOS_MS);
  }

  await markCampaignSentIfComplete(pending.map((s) => s.campaignId));

  return { processed: pending.length, errors };
}

/**
 * Cierra la campaña cuando ya no queda nada en cola.
 *
 * Exige al menos un envío exitoso: si fallaron todos —una API key sin permiso
 * sobre el dominio, por ejemplo— marcarla como SENT diría que salió cuando no
 * salió nada, y además el cron dejaría de tomarla, porque sólo procesa las que
 * están en SENDING. Dejarla abierta permite corregir la causa y reencolar.
 */
async function markCampaignSentIfComplete(campaignIds: number[]) {
  const unique = [...new Set(campaignIds)];
  for (const cid of unique) {
    const [queued, enviados, sending] = await Promise.all([
      prisma.emailSend.count({ where: { campaignId: cid, status: "QUEUED" } }),
      prisma.emailSend.count({ where: { campaignId: cid, status: "SENT" } }),
      prisma.emailCampaign.findUnique({ where: { id: cid }, select: { status: true } }),
    ]);

    if (queued === 0 && enviados > 0 && sending?.status === "SENDING") {
      await prisma.emailCampaign.update({
        where: { id: cid },
        data: { status: "SENT" },
      });
    }
  }
}
