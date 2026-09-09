import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { syncWorkspaceCalendar } from "@/lib/bookings/calendar/sync";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Espeja las reservas con Google Calendar, en las dos direcciones.
 *
 * Pensada para correr cada 10 minutos. Es idempotente: una reserva que ya tiene su evento
 * no se vuelve a crear, y un bloqueo que ya existe se actualiza en vez de duplicarse.
 *
 * **Nunca falla por Google.** Si una institución no conectó su cuenta, o el permiso fue
 * revocado, esa institución se saltea con su motivo y las demás siguen.
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
    const conModulo = await prisma.workspaceFeatureModule.findMany({
      where: { moduleKey: BOOKINGS_MODULE_KEY, enabled: true },
      select: { workspaceId: true },
    });

    const reportes = [];
    for (const { workspaceId } of conModulo) {
      const r = await syncWorkspaceCalendar(workspaceId);
      reportes.push({ workspaceId, ...r });
    }

    return NextResponse.json({ ok: true, workspaces: reportes.length, reportes });
  } catch (error) {
    console.error("[fotoffice][calendar] falló la corrida de sincronización", {
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "falló la sincronización" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
