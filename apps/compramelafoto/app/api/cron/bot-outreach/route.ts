import type { NextRequest } from "next/server";
import { enviarMailsOutreach } from "@/lib/bot/outreach-email";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Mail diario a los fotógrafos que no entran. Apagado salvo CLF_BOT_ENABLED=1 y CLF_BOT_OUTREACH_EMAIL_ENABLED=1. */
export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;
  if (process.env.CLF_BOT_ENABLED?.trim() !== "1" || process.env.CLF_BOT_OUTREACH_EMAIL_ENABLED?.trim() !== "1") {
    return Response.json({ ok: true, skipped: true });
  }
  const r = await enviarMailsOutreach(new Date());
  return Response.json({ ok: true, ...r });
}
