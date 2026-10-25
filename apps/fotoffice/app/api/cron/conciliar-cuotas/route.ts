import { NextResponse } from "next/server";
import { reconcilePendingDues } from "@/lib/membership/reconcile";
import { cleanupAbandonedRenewals } from "@/lib/membership/enrollment-store";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Concilia los pagos de cuotas que quedaron pendientes.
 *
 * Pensada para correr cada hora. Es idempotente: un pago ya acreditado no se vuelve a
 * acreditar, así que correrla de más no rompe nada.
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
    const reporte = await reconcilePendingDues();
    // Después de conciliar: un pago que acaba de acreditarse ya imputó su renovación y no se
    // borra. Las que siguen intactas a los 3 días se borran para que no queden como deuda.
    const renovacionesBorradas = await cleanupAbandonedRenewals();
    return NextResponse.json({ ok: true, ...reporte, renovacionesBorradas });
  } catch (error) {
    console.error("[fotoffice][conciliacion] fallo la corrida", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "fallo la conciliación" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
