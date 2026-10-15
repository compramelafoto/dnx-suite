import { NextResponse } from "next/server";
import { sendDueRemindersForAllWorkspaces } from "@/lib/membership/dues-reminder";
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
 * El recordatorio de cuota de cada institución, en su día.
 *
 * Corre a las 9 de Rosario y no de madrugada con la generación: un correo que llega a las 3
 * de la mañana queda enterrado debajo de todo lo que entra antes de que la persona lo abra.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }
  try {
    const reportes = await sendDueRemindersForAllWorkspaces();
    return NextResponse.json({ ok: true, reportes });
  } catch (error) {
    console.error("[fotoffice][cuotas] falló el recordatorio", { detalle: sanitizeError(error) });
    return NextResponse.json({ ok: false, error: "falló el recordatorio" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
