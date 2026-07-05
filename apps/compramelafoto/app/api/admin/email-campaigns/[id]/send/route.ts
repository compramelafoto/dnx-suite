import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAudienceRecipients, type AudienceFilters } from "@/lib/email-marketing/audience";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

const MAX_CAMPAIGN_RECIPIENTS = 50000;

async function ensureUnsubscribeToken(userId: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unsubscribeToken: true },
  });
  if (!user) throw new Error("Usuario no encontrado");
  if (user.unsubscribeToken) return user.unsubscribeToken;

  const token = randomBytes(24).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { unsubscribeToken: token },
  });
  return token;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth([Role.ADMIN]);
  if (error) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const campaign = await prisma.emailCampaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });

  if (!["DRAFT", "PAUSED"].includes(campaign.status)) {
    return NextResponse.json(
      { error: "Solo se puede enviar una campaña en estado DRAFT o PAUSED" },
      { status: 400 }
    );
  }

  const audienceJson = (campaign.audienceJson ?? {}) as AudienceFilters;
  const recipients = await getAudienceRecipients(audienceJson, { limit: MAX_CAMPAIGN_RECIPIENTS });

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No hay destinatarios elegibles. Verifica que marketingOptIn=true y unsubscribedAt=null" },
      { status: 400 }
    );
  }

  const needsToken = recipients.filter((r) => !r.unsubscribeToken);
  const BATCH = 50;
  for (let i = 0; i < needsToken.length; i += BATCH) {
    const batch = needsToken.slice(i, i + BATCH);
    await Promise.all(batch.map((r) => ensureUnsubscribeToken(r.id)));
  }

  await prisma.$transaction([
    prisma.emailCampaign.update({
      where: { id },
      data: { status: "SENDING" },
    }),
    prisma.emailSend.createMany({
      data: recipients.map((r) => ({
        campaignId: id,
        toEmail: r.email,
        toUserId: r.id,
        status: "QUEUED" as const,
      })),
    }),
  ]);

  const count = recipients.length;
  return NextResponse.json({
    success: true,
    queued: count,
    message: `Se encolaron ${count} emails. Se enviarán gradualmente.`,
  });
}
