import { NextResponse } from "next/server";
import { processDueSocialPublishes } from "@/lib/social-publisher/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cron autenticado; el worker solo usa Meta si DNX_SOCIAL_PUBLISHER_LIVE=true. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  return NextResponse.json({ ok: true, processed: await processDueSocialPublishes(50) });
}
