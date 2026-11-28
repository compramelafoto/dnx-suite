import { NextResponse } from "next/server";
import { runGrowingPackSync } from "@/lib/album-packs/growing-pack/sync-growing-pack-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  return isVercelCron;
}

/** Suma a los packs «Todas mis fotos» de varios días las fotos nuevas donde aparece el comprador. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await runGrowingPackSync();
  return NextResponse.json({ ok: true, ...result });
}
