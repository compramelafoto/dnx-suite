import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cursosDelAlbum } from "@/lib/mosaico/curso";
import { accesoAlMosaico, respuestaDeError } from "./acceso";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/dashboard/albums/[id]/mosaico — los cursos del padrón con cuántos tienen retrato. */
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const acceso = await accesoAlMosaico((await context.params).id);
    if (!acceso.ok) return acceso.res;
    const cursos = await cursosDelAlbum(prisma, acceso.albumId);
    return NextResponse.json({ cursos });
  } catch (e) {
    return respuestaDeError(e, "GET /api/dashboard/albums/[id]/mosaico");
  }
}
