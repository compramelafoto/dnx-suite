import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { sanitizeError } from "@/lib/payments/connect/log";
import { resumePendingCampaigns, sendOccasionsForToday, sendWeeklyDigest } from "@/lib/mailing/campaigns";
import { isDigestWindow } from "@/lib/mailing/schedule";
import { isOccasionWindow } from "@/lib/mailing/occasions";
import { sendDueMessages } from "@/lib/mailing/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Correo a socios, cada 10 minutos:
 *
 * 1. Retoma los envíos que quedaron a medias (una tanda que el proveedor rechazó de pasada, o una
 *    función que se cortó). Cada fila se manda una sola vez: ver `lib/mailing/campaigns.ts`.
 * 2. Los lunes desde las 9:00 (hora argentina) arma el resumen semanal del blog de cada institución
 *    que lo tenga encendido. Uno por semana: lo garantiza la clave única del envío.
 * 3. Todos los días desde las 9:00: fechas especiales, cumpleaños y aniversarios de ingreso
 *    (Comunicación → Fechas). Uno por día cada uno, por la misma razón.
 * 4. Las campañas programadas cuya hora ya llegó (Comunicación → Campañas).
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
  const deadline = Date.now() + 240_000;
  const now = new Date();

  let retomados = { campaigns: 0, sent: 0 };
  try {
    retomados = await resumePendingCampaigns(deadline);
  } catch (error) {
    console.error("[fotoffice][correo] falló la retoma de envíos", { detalle: sanitizeError(error) });
  }

  let programadas: Record<string, string> = {};
  try {
    programadas = await sendDueMessages(now, deadline);
  } catch (error) {
    console.error("[fotoffice][correo] fallaron las campañas programadas", { detalle: sanitizeError(error) });
  }

  const resumenes: Record<string, string> = {};
  if (isDigestWindow(now)) {
    const instituciones = await prisma.fotofficeMailingSettings.findMany({
      where: { bulkEnabled: true, weeklyBlogDigest: true },
      select: { workspaceId: true },
    });
    for (const { workspaceId } of instituciones) {
      if (Date.now() >= deadline) break;
      try {
        const r = await sendWeeklyDigest(workspaceId, now, deadline);
        resumenes[workspaceId] = r.status;
      } catch (error) {
        resumenes[workspaceId] = "ERROR";
        console.error("[fotoffice][correo] falló el resumen semanal", { workspaceId, detalle: sanitizeError(error) });
      }
    }
  }

  const saludos: Record<string, Record<string, string>> = {};
  if (isOccasionWindow(now)) {
    const instituciones = await prisma.fotofficeMailingSettings.findMany({
      where: { bulkEnabled: true },
      select: { workspaceId: true },
    });
    for (const { workspaceId } of instituciones) {
      if (Date.now() >= deadline) break;
      try {
        saludos[workspaceId] = await sendOccasionsForToday(workspaceId, now, deadline);
      } catch (error) {
        saludos[workspaceId] = { error: "ERROR" };
        console.error("[fotoffice][correo] fallaron los saludos del día", { workspaceId, detalle: sanitizeError(error) });
      }
    }
  }

  return NextResponse.json({ ok: true, retomados, programadas, resumenes, saludos });
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
