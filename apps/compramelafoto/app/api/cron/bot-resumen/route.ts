import type { NextRequest } from "next/server";
import { sendTelegramMessage } from "@repo/dnx-bot";
import { BOT_PLATFORM, readBotConfig } from "@/lib/bot/config";
import { buildDailySummary } from "@/lib/bot/resumen";
import { assertCronAuth } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  // Con el bot apagado no se manda el resumen diario ni se limpia nada.
  if (!readBotConfig().enabled) return Response.json({ ok: true, skipped: true });
  const now = new Date();
  const expired = await prisma.botAction.updateMany({
    where: { platform: BOT_PLATFORM, status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  // BotMessage se borra en cascada; BotAction.conversationId queda en null (las acciones se conservan).
  const purged = await prisma.botConversation.deleteMany({
    where: { platform: BOT_PLATFORM, createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
  });
  const text = await buildDailySummary(now);
  const sent = await sendTelegramMessage(readBotConfig().telegram, text);
  return Response.json({ ok: true, expired: expired.count, purged: purged.count, telegram: sent });
}
