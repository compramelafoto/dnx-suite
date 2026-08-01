import { NextResponse } from "next/server";
import { expireStoreHoldsBatch } from "@/lib/public-store/checkout/expire-store-holds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Expira holds TIENDA vencidos (idempotente, por lotes).
 * Auth: Bearer CRON_SECRET o header Vercel Cron.
 * Mantener activo aunque checkout esté OFF (órdenes pendientes).
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

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const result = await expireStoreHoldsBatch({ dryRun, limit: 100 });
  return NextResponse.json({ ok: true, ...result });
}
