import type { NextRequest } from "next/server";
import { manejarSesion } from "@/lib/control-remoto/rutas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/control-remoto/<id> — la pantalla y el celular conversan por acá (ver `lib/control-remoto`). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return manejarSesion(req, id);
}
