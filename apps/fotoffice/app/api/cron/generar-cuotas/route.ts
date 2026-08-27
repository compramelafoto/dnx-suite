import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { generateMonthlyCharges } from "@/lib/membership/generate-monthly";
import { periodOf } from "@/lib/membership/monthly-plan";
import { getDuesSettings } from "@/lib/membership/settings";
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
 * Genera las cuotas del mes de cada institución.
 *
 * Corre todos los días y **cada institución decide su propio día de generación**: correr
 * a diario y preguntar es más simple y más robusto que programar una tarea por institución.
 * Como generar es idempotente, un día de más no rompe nada.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const ahora = new Date();
  const period = periodOf(ahora);
  const diaDeHoy = ahora.getUTCDate();

  try {
    const workspaces = await prisma.workspace.findMany({
      where: { institutionalMembers: { some: { status: "ACTIVE" } } },
      select: { id: true, name: true },
    });

    const reportes: Array<{ workspace: string; creadas: number; yaExistian: number }> = [];
    for (const ws of workspaces) {
      const settings = await getDuesSettings(ws.id);
      if (settings.generationDay !== diaDeHoy) continue;

      const r = await generateMonthlyCharges({ workspaceId: ws.id, period });
      reportes.push({ workspace: ws.name, creadas: r.creadas, yaExistian: r.yaExistian });
    }

    return NextResponse.json({ ok: true, period, reportes });
  } catch (error) {
    console.error("[fotoffice][cuotas] fallo la generacion mensual", {
      period,
      detalle: sanitizeError(error),
    });
    return NextResponse.json({ ok: false, error: "fallo la generación" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
