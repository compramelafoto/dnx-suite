import { NextResponse } from "next/server";
import { enviarPedidosAutomaticos } from "@/lib/testimonios/automatico";
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
 * Pedido automático de testimonios (sitio, PR 3): una vez por día, a las 11 de Buenos Aires
 * (14:00 UTC). Sólo trabaja en las organizaciones que lo encendieron (apagado por omisión).
 * Devuelve sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await enviarPedidosAutomaticos();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][testimonios] falló el pedido automático", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el pedido automático" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
