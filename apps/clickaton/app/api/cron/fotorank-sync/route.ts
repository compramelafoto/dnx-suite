import { NextResponse } from "next/server";
import { processDueFotoRankSyncs } from "@/lib/fotorank-sync/infrastructure/prisma-fotorank-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Procesa syncs FotoRank pendientes / retry.
 * Auth: Bearer CRON_SECRET o header Vercel Cron.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  const ok =
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1");
  if (!ok) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const processed = await processDueFotoRankSyncs(50);
  return NextResponse.json({ ok: true, processed });
}
