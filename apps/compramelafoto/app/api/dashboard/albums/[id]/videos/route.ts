import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { videoMvpDisabledResponse } from "@/lib/videos/video-api-guard";
import { toVideoAssetDto } from "@/lib/videos/video-dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAlbumReadAccess(albumId: number, userId: number) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { userId: true, isPublic: true, isHidden: true },
  });
  if (!album) {
    return { ok: false as const, status: 404, error: "Álbum no encontrado" };
  }
  if (album.userId !== userId) {
    const collab = await prisma.albumAccess.findUnique({
      where: { albumId_userId: { albumId, userId } },
    });
    if (!collab && (!album.isPublic || album.isHidden)) {
      return { ok: false as const, status: 403, error: "Sin acceso a este álbum" };
    }
  }
  return { ok: true as const };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return videoMvpDisabledResponse();
    }

    const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const access = await ensureAlbumReadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const videos = await prisma.videoAsset.findMany({
      where: { albumId, isRemoved: false },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json({
      videos: videos.map(toVideoAssetDto),
    });
  } catch (err: unknown) {
    console.error("[videos] list error", err);
    return NextResponse.json({ error: "Error listando videos" }, { status: 500 });
  }
}
