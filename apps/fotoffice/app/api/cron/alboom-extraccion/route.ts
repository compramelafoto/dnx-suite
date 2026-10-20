import { NextResponse } from "next/server";
import { correrExtraccionesAlboom } from "@/lib/alboom/correr";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cada 5 minutos: avanza las extracciones de Alboom activas (Configuración → Migración desde Alboom), con un
 * presupuesto de 270 s y un pedido por segundo por workspace. Retoma desde el avance guardado. Sólo lee Alboom.
 * La respuesta lleva sólo ids y resultados: nunca datos extraídos.
 */
function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  try {
    const resultados = await correrExtraccionesAlboom();
    return NextResponse.json({ ok: true, resultados });
  } catch (error) {
    console.error("[fotoffice][alboom-extraccion] falló la tanda", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la extracción de Alboom" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
