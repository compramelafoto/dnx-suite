import { NextRequest, NextResponse } from "next/server";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { periodoDeResumen, resumenBot } from "@/lib/soporte/resumen-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD (días argentinos; por defecto, los últimos 15). */
export async function GET(req: NextRequest) {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const q = req.nextUrl.searchParams;
  const { desde, hasta } = periodoDeResumen(q.get("desde"), q.get("hasta"), new Date());
  const resumen = await resumenBot(desde, hasta);
  return NextResponse.json({ desde, hasta, ...resumen });
}
