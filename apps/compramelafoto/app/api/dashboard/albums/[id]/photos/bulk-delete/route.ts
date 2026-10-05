import { NextRequest, NextResponse, after } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import {
  MAX_PHOTOS_PER_DELETE_REQUEST,
  markAlbumPhotosForDeletion,
  purgePhotosPendingDeletion,
} from "@/lib/albums/delete-album-photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// El tope lo usa el borrado en segundo plano (`after`); lo que no entre lo termina el cron.
export const maxDuration = 300;

/**
 * POST /api/dashboard/albums/[id]/photos/bulk-delete  { photoIds: number[] }
 *
 * Responde en cuanto las fotos quedan retiradas (desaparecen del panel y de la galería) y
 * borra los archivos después de responder. Ver `lib/albums/delete-album-photos.ts`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user || (user.role !== Role.PHOTOGRAPHER && user.role !== Role.LAB_PHOTOGRAPHER)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = Number.parseInt(id, 10);
    if (!Number.isFinite(albumId) || albumId <= 0) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { photoIds?: unknown } | null;
    const photoIds = Array.isArray(body?.photoIds)
      ? body.photoIds.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0)
      : [];
    if (photoIds.length === 0) {
      return NextResponse.json({ error: "No hay fotos para eliminar." }, { status: 400 });
    }
    if (photoIds.length > MAX_PHOTOS_PER_DELETE_REQUEST) {
      return NextResponse.json(
        { error: `Se pueden eliminar hasta ${MAX_PHOTOS_PER_DELETE_REQUEST} fotos por vez.` },
        { status: 400 }
      );
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { userId: true, deletedAt: true },
    });
    if (!album || album.deletedAt) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const result = await markAlbumPhotosForDeletion({
      albumId,
      albumOwnerId: album.userId,
      userId: user.id,
      photoIds,
    });

    if (result.pendingPurge > 0) {
      const startedAt = Date.now();
      after(async () => {
        // Margen de 30 s sobre `maxDuration` para no cortar una foto a mitad de camino.
        const r = await purgePhotosPendingDeletion({
          albumId,
          deadlineMs: startedAt + (maxDuration - 30) * 1000,
        });
        console.info("[bulk-delete] purga en segundo plano", { albumId, ...r });
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: unknown) {
    console.error("POST /api/dashboard/albums/[id]/photos/bulk-delete ERROR >>>", err);
    return NextResponse.json({ error: "Error eliminando fotos" }, { status: 500 });
  }
}
