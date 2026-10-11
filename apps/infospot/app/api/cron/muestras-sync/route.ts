/**
 * Cron: muestras de muestrasfotograficas.com → eventos de Info Spot.
 * Una vez por semana, los jueves a las 10:00 hora argentina (13:00 UTC en vercel.json): decisión
 * de Daniel del 10/10, para que las muestras se publiquen de a tandas.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (o x-cron-secret). Sin secreto → 503.
 * `?dryRun=1` cuenta lo que haría sin escribir.
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcileMuestras } from "@/lib/muestras-sync/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorize(req: NextRequest, secret: string): boolean {
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === secret || alt === secret;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (!authorize(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const started = Date.now();
  try {
    const summary = await reconcileMuestras({ dryRun });
    return NextResponse.json({ ok: summary.failed === 0, job: "muestras-sync", durationMs: Date.now() - started, ...summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, job: "muestras-sync", error: err instanceof Error ? err.message : String(err), durationMs: Date.now() - started },
      { status: 500 },
    );
  }
}
