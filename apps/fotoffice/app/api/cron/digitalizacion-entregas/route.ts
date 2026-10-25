import { NextResponse } from "next/server";
import { enviarEntregasAutomaticas } from "@/lib/digitalizacion/servidor/entregas";
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
 * Entrega automática de videos digitalizados (spec 2026-10-22, E2/E3): cada 15 minutos crea o mira
 * la entrega de los pedidos con videos convertidos y manda el correo de las que están listas y
 * tienen el envío automático encendido. Devuelve sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await enviarEntregasAutomaticas();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][digitalizacion] falló el envío automático de entregas", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el envío de entregas" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
