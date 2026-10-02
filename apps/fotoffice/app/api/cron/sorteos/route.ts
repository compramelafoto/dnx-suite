import { NextResponse } from "next/server";
import { generateMonthlyRaffles } from "@/lib/raffles/monthly";
import { sealDueRaffles } from "@/lib/raffles/seal";
import { resolveDueRaffles } from "@/lib/raffles/resolve";
import { expireUnclaimedPrizes } from "@/lib/raffles/delivery";
import { notifyPendingAwards } from "@/lib/raffles/notify";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Arma el sorteo del mes, sella los padrones vencidos, resuelve los sorteos cuyo acto ya pasó,
 * avisa a quien corresponde y vence los premios que nadie retiró.
 *
 * Las tres cosas son idempotentes, así que correrla de más no cambia nada. Y no es la única
 * manera de que ocurran: la primera visita posterior también sella y resuelve. Un sorteo no
 * puede quedar colgado porque una tarea programada no corrió.
 *
 * El orden importa: primero sellar, después resolver, después avisar. Un sorteo que cierra su
 * padrón y se sortea dentro de la misma ventana de quince minutos queda resuelto y avisado en
 * la misma pasada.
 *
 * Los avisos se reintentan solos: `notifyPendingAwards` sólo marca como enviado lo que salió,
 * así que un correo que rebotó vuelve a intentarse en la pasada siguiente.
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
    const mensual = await generateMonthlyRaffles();
    const sellado = await sealDueRaffles();
    const sorteado = await resolveDueRaffles();
    const avisos = await notifyPendingAwards();
    const vencidos = await expireUnclaimedPrizes();
    return NextResponse.json({ ok: true, mensual, sellado, sorteado, avisos, vencidos });
  } catch (error) {
    console.error("[fotoffice][sorteos] falló la tarea programada", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la tarea de sorteos" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
