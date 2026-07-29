import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { listPublicReadyVideosForAlbum } from "@/lib/videos/public-ready-videos";
import { resolveAlbumPublicVideoAccess } from "@/lib/videos/public-album-video-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/albums/[slug]/videos
 * Videos listos para galería (preview con marca de agua, sin original).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ videos: [] });
    }

    const { slug } = await Promise.resolve(params);
    if (!slug?.trim()) {
      return NextResponse.json({ error: "Slug requerido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { publicSlug: slug.trim(), deletedAt: null },
      select: {
        id: true,
        userId: true,
        isTest: true,
        isPublic: true,
        isHidden: true,
        hiddenPhotosEnabled: true,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const accessResult = await resolveAlbumPublicVideoAccess(req, album);
    if (!accessResult.ok) {
      return accessResult.response;
    }

    const { videos, devDiagnostics } = await listPublicReadyVideosForAlbum(prisma, album.id, {
      applyExpiresFilter: accessResult.access.applyExpiresFilter,
    });

    return NextResponse.json({
      videos,
      ...(devDiagnostics ? { _devDiagnostics: devDiagnostics } : {}),
    });
  } catch (err: unknown) {
    console.error("[public/albums/videos] GET error", err);
    return NextResponse.json({ error: "Error listando videos" }, { status: 500 });
  }
}
