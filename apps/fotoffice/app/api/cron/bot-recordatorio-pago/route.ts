import { NextResponse } from "next/server";
import { recordarPagosPendientes } from "@/lib/bandeja/bot/recordatorio-pago-servidor";
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
 * Recordatorio de pago del bot de WhatsApp: cada 15 minutos busca los chats con un pedido sin pagar
 * cerca del final de la ventana de 24 h y les escribe una vez. Devuelve sólo contadores.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reporte = await recordarPagosPendientes();
    return NextResponse.json({ ok: true, ...reporte });
  } catch (error) {
    console.error("[fotoffice][whatsapp] fallaron los recordatorios de pago", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "fallaron los recordatorios" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
