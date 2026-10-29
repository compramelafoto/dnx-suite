import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireDesignActor } from "@/lib/design-v2/http";
import { designPhotoDisplayUrl } from "@/lib/design-v2/projects";
import { FOTOS_DEMO_SIN_PUBLICAR } from "@/lib/demos/identidad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS = 400;

/**
 * Fotos que se pueden usar para probar un diseño: las publicadas y, en las demos, las de la toma
 * que todavía no se publicaron (son del mismo fotógrafo y en el modo prueba nada se guarda).
 */
const FOTOS_PARA_PROBAR = {
  OR: [{ isRemoved: false }, { removedReason: FOTOS_DEMO_SIN_PUBLICAR }],
};

/**
 * GET /api/fotografo/diseno/fotos — para el modo prueba.
 * Sin `albumId`: los álbumes del fotógrafo con fotos. Con `albumId`: las fotos de ese álbum.
 */
export async function GET(req: Request) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;

  const albumId = Number(new URL(req.url).searchParams.get("albumId"));
  if (!Number.isInteger(albumId) || albumId <= 0) {
    const albums = await prisma.album.findMany({
      where: { userId: actor.id, photos: { some: FOTOS_PARA_PROBAR } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, title: true, _count: { select: { photos: { where: FOTOS_PARA_PROBAR } } } },
    });
    return NextResponse.json({
      ok: true,
      albums: albums.map((a) => ({ id: a.id, title: a.title, photoCount: a._count.photos })),
    });
  }

  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { userId: true } });
  if (!album || (actor.role !== "ADMIN" && album.userId !== actor.id)) {
    return NextResponse.json({ ok: false, error: "No encontramos ese álbum." }, { status: 404 });
  }
  const photos = await prisma.photo.findMany({
    where: { albumId, ...FOTOS_PARA_PROBAR },
    orderBy: { id: "asc" },
    take: MAX_PHOTOS,
    select: { id: true, previewUrl: true, originalKey: true },
  });
  return NextResponse.json({
    ok: true,
    photos: photos.map((p) => ({ id: p.id, url: designPhotoDisplayUrl(p) })),
    truncated: photos.length === MAX_PHOTOS,
  });
}
