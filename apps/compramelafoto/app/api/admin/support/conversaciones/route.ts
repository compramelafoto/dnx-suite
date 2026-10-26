import { NextRequest, NextResponse } from "next/server";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { listarConversacionesResueltas } from "@/lib/soporte/resumen-bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?page=0 — charlas con el bot que no terminaron en ticket, de a 30. */
export async function GET(req: NextRequest) {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const page = Number(req.nextUrl.searchParams.get("page") ?? 0);
  return NextResponse.json(await listarConversacionesResueltas(page));
}
