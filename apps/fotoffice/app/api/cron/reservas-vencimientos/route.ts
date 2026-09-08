import { NextResponse } from "next/server";
import { expireStaleHolds } from "@/lib/bookings/lifecycle";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Libera los horarios bloqueados que nadie pagó ni resolvió.
 *
 * Pensada para correr cada 15 minutos. Es idempotente: un bloqueo vencido no puede volver a
 * vencer, así que correrla de más no rompe nada.
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
    const reporte = await expireStaleHolds();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][reservas] falló la expiración de bloqueos", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la expiración" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
