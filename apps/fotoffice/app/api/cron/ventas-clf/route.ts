import { NextResponse } from "next/server";
import { sincronizarTodos } from "@/lib/clf/sincronizar";
import { sanitizeError } from "@/lib/payments/connect/log";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cada 15 minutos: trae las ventas de CLF de cada espacio con la conexión abierta y las valida contra su Mercado
 * Pago (conexión con CLF, etapa 2). Nunca escribe en la Caja. La respuesta lleva sólo cantidades.
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
    const r = await sincronizarTodos();
    return NextResponse.json({ ok: true, ...r });
  } catch (error) {
    console.error("[fotoffice][ventas-clf] falló la corrida", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló la sincronización con CLF" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
