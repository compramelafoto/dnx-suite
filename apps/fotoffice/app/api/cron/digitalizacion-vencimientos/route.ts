import { NextResponse } from "next/server";
import { recordatoriosYVencimientos } from "@/lib/digitalizacion/servidor/entregas";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

/**
 * Recordatorios y vencimiento de los videos entregados (spec 2026-10-22, E8): una vez por día, a
 * las 10 de Buenos Aires (13:00 UTC). Avisa a 10, 5 y 1 día y borra de R2 lo vencido. Devuelve
 * sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await recordatoriosYVencimientos();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][digitalizacion] fallaron los recordatorios de videos", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "fallaron los recordatorios" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
