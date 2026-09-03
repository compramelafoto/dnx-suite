import { NextResponse } from "next/server";
import { purgeExpiredNotes } from "@/lib/participant-notes/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Borra las anotaciones de las ediciones cuya entrega cerró hace más de 30 días.
 *
 * El plazo se calcula acá, no se guarda en cada fila: si el cronograma se mueve,
 * el vencimiento se corrige solo.
 *
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
  const result = await purgeExpiredNotes({ dryRun });

  return NextResponse.json({ ok: true, dryRun, ...result });
}
