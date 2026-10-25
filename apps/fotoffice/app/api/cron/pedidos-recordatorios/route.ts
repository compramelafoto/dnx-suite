import { NextResponse } from "next/server";
import { enviarRecordatoriosDeCuotas } from "@/lib/pedidos/recordatorios";
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
 * Recordatorio de vencimiento de cuotas de pedidos (etapa 3, Entrega B1): una vez por día, a las
 * 10 de Buenos Aires (13:00 UTC). Devuelve sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await enviarRecordatoriosDeCuotas();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][pedidos] fallaron los recordatorios de cuotas", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "fallaron los recordatorios" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
