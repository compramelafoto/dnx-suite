import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { ensureCurrentSpotlight } from "@/lib/spotlight/repository";
import { sendSpotlightNudge } from "@/lib/spotlight/nudge";

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
 * Después de elegir, si la tarjeta del socio muestra poco, le avisa que complete su perfil
 * (`lib/spotlight/nudge.ts`): una vez por semana destacada.
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
  let avisos = 0;
  for (const { workspaceId } of instituciones) {
    try {
      const destacado = await ensureCurrentSpotlight(workspaceId);
      if (destacado) {
        elegidos += 1;
        // Si su tarjeta muestra poco, se le pide que complete su perfil. Una sola vez por semana
        // destacada (`nudgeSentAt`); si el correo falla, la próxima pasada lo reintenta.
        const aviso = await sendSpotlightNudge({ workspaceId, spotlightId: destacado.id });
        if (aviso.status === "SENT") avisos += 1;
        if (aviso.status === "FAILED") {
          console.error("[fotoffice][socio-de-la-semana] no salió el aviso", { workspaceId, error: aviso.error });
        }
      }
    } catch (error) {
      fallidos += 1;
      console.error("[fotoffice][socio-de-la-semana] falló la elección", {
        workspaceId,
        detalle: sanitizeError(error),
      });
    }
  }
  return NextResponse.json({ ok: fallidos === 0, instituciones: instituciones.length, elegidos, avisos, fallidos });
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
