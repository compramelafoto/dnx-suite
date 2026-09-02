import { NextResponse } from "next/server";
import { createPrismaPromptReleaseStore } from "@/lib/timeline/prisma-scheduled-release";
import { releaseScheduledPrompts } from "@/lib/timeline/scheduled-release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Libera consignas cuya hora planificada ya pasó.
 * Auth: Authorization Bearer CRON_SECRET, o header de Vercel Cron.
 */
export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await releaseScheduledPrompts(createPrismaPromptReleaseStore(), { dryRun });

  return NextResponse.json({ ok: true, dryRun, ...result });
}
