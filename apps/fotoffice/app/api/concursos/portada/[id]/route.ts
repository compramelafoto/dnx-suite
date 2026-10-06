import { NextResponse } from "next/server";
import { prisma } from "@repo/db";

export const runtime = "nodejs";

/**
 * Portada de un concurso público de FotoRank guardada como imagen incrustada (`data:image/...`).
 *
 * Mandarla dentro de la página pesaría cientos de KB por tarjeta; acá se sirve como imagen común
 * y el navegador la guarda un día. Sólo concursos públicos: lo privado no se expone.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.fotorankContest.findFirst({
    where: { id, visibility: "PUBLIC" },
    select: { coverImageUrl: true },
  });
  const m = c?.coverImageUrl ? /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s.exec(c.coverImageUrl) : null;
  if (!m) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(m[2]!, "base64"), {
    headers: {
      "Content-Type": m[1]!,
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
