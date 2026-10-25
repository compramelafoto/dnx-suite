import { NextResponse } from "next/server";
import { plantillasConMosaico } from "@/lib/mosaico/carpetas-del-curso";
import { accesoAlMosaico, respuestaDeError } from "../acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/dashboard/albums/[id]/mosaico/plantillas — las plantillas con «Mosaico del curso» que puede usar. */
export async function GET(_req: Request, context: Ctx) {
  try {
    const acceso = await accesoAlMosaico((await context.params).id);
    if (!acceso.ok) return acceso.res;
    return NextResponse.json({ plantillas: await plantillasConMosaico(acceso.userId) });
  } catch (e) {
    return respuestaDeError(e, "GET /api/dashboard/albums/[id]/mosaico/plantillas");
  }
}
