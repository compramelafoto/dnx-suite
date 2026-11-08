import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { armarResumen, esIdDeAlbum } from "@/lib/public-album/resumen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_ENCONTRADO = { error: "Álbum no encontrado" } as const;

/**
 * GET /api/public/album/[slug]/resumen
 * Título, slug y estado de preventa de un álbum publicado. Lo usa FOTOFFICE para vincular un pedido con su
 * álbum de CLF. Si `slug` es sólo dígitos se busca por id (enlaces `/a/<id>`). Sin datos de compradores ni de
 * alumnos (ver `lib/public-album/resumen.ts`).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const segmento = (await params).slug?.trim() ?? "";
    if (!segmento || segmento.length > 200) return NextResponse.json(NO_ENCONTRADO, { status: 404 });

    const id = esIdDeAlbum(segmento);
    const album = await prisma.album.findFirst({
      where: id !== null ? { id } : { publicSlug: segmento },
      select: { id: true, title: true, publicSlug: true, isTest: true, isHidden: true, deletedAt: true },
    });
    if (!album) return NextResponse.json(NO_ENCONTRADO, { status: 404 });

    const packs = await prisma.packDefinition.findMany({ where: { albumId: album.id }, select: { validUntil: true, isActive: true } });
    const resumen = armarResumen(album, packs);
    if (!resumen) return NextResponse.json(NO_ENCONTRADO, { status: 404 });

    return NextResponse.json(resumen, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("GET /api/public/album/[slug]/resumen", error);
    return NextResponse.json({ error: "No se pudo leer el álbum" }, { status: 500 });
  }
}
