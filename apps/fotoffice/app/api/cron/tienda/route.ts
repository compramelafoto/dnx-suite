import { NextResponse } from "next/server";
import { reconcilePendingOrders } from "@/lib/store/expire";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Conciliación de la tienda: vence los pedidos que nadie pagó y acredita los pagos que el aviso
 * de Mercado Pago no trajo (ver `lib/store/expire.ts`).
 *
 * Corre cada 15 minutos. Es idempotente: correrla de más no rompe nada.
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
    const reporte = await reconcilePendingOrders();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][tienda] falló la conciliación de pedidos", {
      detalle: sanitizeError(error),
    });
    // 200 a propósito: la próxima corrida reintenta sola; el detalle queda en el registro.
    return NextResponse.json({ ok: false, error: "falló la conciliación" }, { status: 200 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
