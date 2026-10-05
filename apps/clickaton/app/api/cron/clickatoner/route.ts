/**
 * Elige al Clickatoner de la semana.
 *
 * Corre cada hora, a los 5 minutos: la pasada del viernes 00:05 hora argentina (03:05 UTC) elige,
 * y las demás no hacen nada porque la elección es idempotente. Correr cada hora es la red por si
 * esa pasada falla. La portada no elige —la visita cualquiera, robots incluidos—; el panel sí.
 *
 * Elegir no tiene efectos hacia afuera (no manda correos ni publica nada), por eso la misma
 * autorización que las demás tareas de Clickatón alcanza.
 */
import { NextResponse } from "next/server";
import { ensureCurrentClickatoner } from "@/lib/clickatoner/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const authorized =
    (Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && request.headers.get("x-vercel-cron") === "1");
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const elegido = await ensureCurrentClickatoner();
    return NextResponse.json({ ok: true, elegido: Boolean(elegido) });
  } catch (error) {
    console.error("[clickaton][clickatoner] falló la elección:", error);
    return NextResponse.json({ ok: false, error: "PICK_FAILED" }, { status: 500 });
  }
}
