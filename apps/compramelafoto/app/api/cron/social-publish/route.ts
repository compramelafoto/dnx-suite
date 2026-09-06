import { NextResponse } from "next/server";
import { assertCronAuth } from "@/lib/cron-auth";
import { runSocialPublishWorker } from "@/lib/social/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Cron autenticado; el worker solo usa Meta si DNX_SOCIAL_PUBLISHER_LIVE=true. */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;
  const summary = await runSocialPublishWorker(50);
  return NextResponse.json({ ok: true, ...summary });
}
