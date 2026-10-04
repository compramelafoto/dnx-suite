import { NextResponse } from "next/server";
import { processDueParticipantCards } from "@/lib/participant-cards/participant-card-autogenerate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/*
 * Rasterizar carga un WebAssembly de 10 MB y dibuja a 1080×1920. Veinticinco placas en una sola
 * invocación agotan el tiempo o la memoria de la función: las primeras salen y las últimas
 * fallan. De a seis entra holgado, y como el cron corre cada cinco minutos, el backlog igual se
 * despacha solo.
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
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 6;

  const result = await processDueParticipantCards(Number.isFinite(limit) ? limit : 6);
  return NextResponse.json({ ok: true, ...result });
}
