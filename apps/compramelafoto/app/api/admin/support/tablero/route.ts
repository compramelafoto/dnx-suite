import { NextResponse } from "next/server";
import { soloAdmin } from "@/lib/soporte/admin-auth";
import { cargarTablero } from "@/lib/soporte/tablero";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — las fichas del tablero de reclamos. */
export async function GET() {
  const auth = await soloAdmin();
  if (!auth.ok) return auth.res;
  const ahora = new Date();
  return NextResponse.json({ ahora: ahora.toISOString(), fichas: await cargarTablero(ahora) });
}
