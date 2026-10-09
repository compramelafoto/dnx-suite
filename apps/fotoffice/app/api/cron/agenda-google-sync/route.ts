import { NextResponse } from "next/server";
import { organizacionesParaSincronizar, sincronizarAgenda } from "@/lib/agenda/google/sincronizar";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { codigoDeError } from "@/lib/agenda/google/cliente";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Sincroniza la Agenda con su calendario propio de Google Calendar, en las dos direcciones.
 *
 * Pensada para correr cada 10 minutos. Es idempotente. Por corrida se atienden a lo sumo 25
 * organizaciones (las que hace más que no se sincronizan primero) y cada una está aislada: una que falla
 * (cuenta desconectada, Google caído) no frena a las demás. Sólo toca citas y ajustes de la Agenda:
 * nunca los calendarios ni las reservas de Reservas. Los registros llevan códigos, sin datos personales.
 */
const TOPE_ORGANIZACIONES = 25;

function autorizado(request: Request): boolean {
  return isAuthorizedCronRequest({
    authorizationHeader: request.headers.get("authorization"),
    allowedSecrets: [process.env.CRON_SECRET, process.env.FOTOFFICE_CRON_SECRET],
  });
}

export async function POST(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  try {
    const ids = await organizacionesParaSincronizar(TOPE_ORGANIZACIONES);
    const reportes = [];
    for (const workspaceId of ids) {
      try {
        reportes.push(await sincronizarAgenda(workspaceId));
      } catch (error) {
        console.error("[agenda][google] falló la sincronización de una organización", { codigo: codigoDeError(error) });
        reportes.push({ workspaceId, errores: ["ERROR"] });
      }
    }
    return NextResponse.json({ ok: true, workspaces: reportes.length, reportes });
  } catch (error) {
    console.error("[agenda][google] falló la corrida de sincronización", { codigo: codigoDeError(error) });
    return NextResponse.json({ ok: false, error: "falló la sincronización" }, { status: 500 });
  }
}

/** Vercel Cron usa GET. Mismo camino, misma autorización. */
export async function GET(request: Request) {
  return POST(request);
}
