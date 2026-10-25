import { NextResponse } from "next/server";
import { runMpDailySync } from "@/lib/payments/mp/daily-sync";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Revisión diaria de los cobros por Mercado Pago (ver `lib/payments/mp/daily-sync.ts`).
 * Idempotente: correrla de más no rompe nada.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await runMpDailySync();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][mp-sync] falló la revisión", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la revisión" }, { status: 200 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
