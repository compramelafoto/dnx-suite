import { NextResponse } from "next/server";
import { correrVendedor } from "@/lib/agentes/vendedor/motor";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** La corrida usa hasta 4 minutos; el minuto restante es margen para cerrar. */
export const maxDuration = 300;

/** Tiempo de trabajo por corrida: el motor no empieza un envío con menos de 30 s por delante. */
const PRESUPUESTO_MS = 240_000;

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

/**
 * El Vendedor de Contactos DNX: cada 15 minutos procesa las respuestas recibidas y, en días hábiles de
 * 9 a 18, manda los primeros correos y los recordatorios dentro del cupo del día. Respeta la pausa, el
 * tope de gasto de Claude y la salud de la dirección de envío.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await correrVendedor({ presupuestoMs: PRESUPUESTO_MS, motivo: "CRON" });
  return NextResponse.json({ ok: true, ...r });
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
