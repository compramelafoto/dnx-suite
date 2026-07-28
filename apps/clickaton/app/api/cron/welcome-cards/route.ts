import { NextResponse } from "next/server";
import { processDueWelcomeCards } from "@/lib/welcome-card/process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ ok: true, processed: await processDueWelcomeCards(50) });
}
