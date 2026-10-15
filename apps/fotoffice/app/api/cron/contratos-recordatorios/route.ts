import { NextResponse } from "next/server";
import { correrContratosDiario } from "@/lib/contratos/recordatorios";
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
 * Tarea diaria de Contratos (etapa 5): una vez por día, a las 10 de Buenos Aires (13:00 UTC).
 * 1) Recordatorios de firma (según Configuración → Contratos) y 2) reintento del PDF firmado que
 * quedó sin generar o sin enviar. Devuelve sólo contadores, sin datos de nadie.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await correrContratosDiario();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][contratos] falló la tarea diaria", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la tarea de contratos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
