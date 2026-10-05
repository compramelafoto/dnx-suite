import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { ensureCurrentSpotlight } from "@/lib/spotlight/repository";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Elige el Socio de la semana de cada institución con Comunicación prendido.
 *
 * Corre cada hora, a los 5 minutos: la pasada del viernes a las 00:05 hora argentina (03:05 UTC)
 * elige, y las demás no hacen nada porque la elección es idempotente —si la semana ya tiene
 * socio, no lo toca—. Correr cada hora y no sólo los viernes es la red por si esa pasada falla. Tampoco es la única manera de que ocurra: la primera visita al panel del socio
 * o a Comunicación también elige.
 *
 * Una institución que falla no frena a las demás.
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
  const instituciones = await prisma.workspaceFeatureModule.findMany({
    where: { moduleKey: COMMUNICATIONS_MODULE_KEY, enabled: true },
    select: { workspaceId: true },
  });

  let elegidos = 0;
  let fallidos = 0;
  for (const { workspaceId } of instituciones) {
    try {
      if (await ensureCurrentSpotlight(workspaceId)) elegidos += 1;
    } catch (error) {
      fallidos += 1;
      console.error("[fotoffice][socio-de-la-semana] falló la elección", {
        workspaceId,
        detalle: sanitizeError(error),
      });
    }
  }
  return NextResponse.json({ ok: fallidos === 0, instituciones: instituciones.length, elegidos, fallidos });
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
