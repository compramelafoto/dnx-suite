import { NextRequest, NextResponse } from "next/server";
import { processCampaignEmailQueue } from "@/lib/email-marketing/process-campaign-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron job para procesar la cola de emails de campañas.
 * Configurar en Vercel: cron every 1 minute
 * O llamar manualmente: POST /api/cron/process-email-campaigns
 * Header: Authorization: Bearer CRON_SECRET (opcional)
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processCampaignEmailQueue();
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
