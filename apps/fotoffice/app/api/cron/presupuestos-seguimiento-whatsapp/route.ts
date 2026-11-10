import { NextResponse } from "next/server";
import { seguirCotizacionesPorWhatsapp } from "@/lib/presupuestos/seguimiento-whatsapp-servidor";
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
 * Seguimiento por WhatsApp de las cotizaciones de eventos sin respuesta (2, 7 y 12 días después
 * de mandadas), una vez por día a las 10 de Argentina. Devuelve sólo contadores.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await seguirCotizacionesPorWhatsapp();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][seguimiento] falló el seguimiento de cotizaciones por WhatsApp", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "fallaron los recordatorios" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
