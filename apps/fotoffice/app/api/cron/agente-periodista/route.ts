import { NextResponse } from "next/server";
import { correrPeriodista } from "@/lib/agentes/periodista/flujo";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Claude con búsqueda web tarda: hasta 5 minutos. */
export const maxDuration = 300;

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

/**
 * El Periodista: lunes, miércoles y viernes 12:00 UTC (9:00 en Argentina) propone una nota para el
 * blog de DNX Estudio por Telegram. Idempotente: si ya hay una propuesta del día pendiente o
 * publicada, no hace nada; tope de 3 corridas por día. Sin el token del bot o sin chat vinculado,
 * tampoco hace nada.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await correrPeriodista({ motivo: "CRON" });
  return NextResponse.json({ ok: r.estado !== "FALLO", estado: r.estado, mensaje: r.mensaje });
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
