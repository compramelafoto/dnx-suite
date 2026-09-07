import { NextResponse } from "next/server";
import { processApplicationDeadlines } from "@/lib/membership/expire-applications";
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
 * Los plazos de las solicitudes aprobadas e impagas.
 *
 * Corre todos los días, para todas las instituciones a la vez: a diferencia de la generación
 * de cuotas, el plazo no lo elige cada institución sino que empieza a correr el día que
 * aprueba, así que no hay ningún día del mes al que esperar.
 *
 * Hace tres cosas, en este orden: cierra las que ya están pagas y nadie había cerrado,
 * recuerda a quien entra en la última semana, y vence a quien se le cumplió el mes. Vencer
 * implica dar de baja al socio que nunca llegó a pagar su ingreso, así que la ruta está
 * cerrada con el mismo secreto que el resto de las tareas: sin él no entra nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  try {
    const reporte = await processApplicationDeadlines();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][alta] fallo la revision de plazos", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la revisión de plazos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
