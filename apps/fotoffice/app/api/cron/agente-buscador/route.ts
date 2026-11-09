import { NextResponse } from "next/server";
import { correrBuscador } from "@/lib/agentes/buscador/motor";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** La corrida usa hasta 4 minutos de búsqueda; el minuto restante es margen para cerrar. */
export const maxDuration = 300;

/** Tiempo de búsqueda por corrida: el motor no empieza un lugar nuevo si quedan menos de 60 s. */
const PRESUPUESTO_MS = 240_000;

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

/**
 * El Buscador de Contactos DNX: cada 15 minutos avanza con las búsquedas de la región en curso (Google
 * Places y la web). Respeta la pausa y los topes de gasto del mes; si no hay región en curso, toma la
 * primera en espera. Sin clave de Google busca sólo en internet.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const r = await correrBuscador({ presupuestoMs: PRESUPUESTO_MS, motivo: "CRON" });
  return NextResponse.json({ ok: true, ...r });
}

/** Vercel Cron usa GET. */
export async function GET(request: Request) {
  return POST(request);
}
