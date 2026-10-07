import { NextResponse } from "next/server";
import { enviarSeguimientos } from "@/lib/presupuestos/seguimiento";
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
 * Seguimiento automático de presupuestos (etapa 2, Entrega B): una vez por día, a las 10 de
 * Buenos Aires (13:00 UTC). Devuelve sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await enviarSeguimientos();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][presupuestos] falló el seguimiento", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el seguimiento" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
