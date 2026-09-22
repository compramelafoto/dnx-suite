import { NextResponse } from "next/server";
import { processDueDiplomas } from "@/lib/diplomas/diploma-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/*
 * Cada diploma renderiza y sube a storage, igual que una placa: de a muchos en
 * una sola invocación se agota el tiempo de la función. El cron corre cada cinco
 * minutos, así que el backlog se despacha solo (ver app/api/cron/participant-cards).
 */
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
  const result = await processDueDiplomas(Number.isFinite(limit) ? limit : 25);
  return NextResponse.json({ ok: true, ...result });
}
