import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { loadAlbumListPhotoAggregates } from "@/lib/albums/album-photo-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Buscar álbumes por título (para unirse como colaborador)
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const title = searchParams.get("title");

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ albums: [] });
    }

    const searchTitle = title.trim();

    const albums = await prisma.album.findMany({
      where: {
        title: {
          equals: searchTitle,
          mode: "insensitive",
        },
        isPublic: true,
        isHidden: false,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        location: true,
        eventDate: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const candidateIds = albums
      .filter((album) => album.userId !== user.id)
      .map((album) => album.id);
    const aggregates = await loadAlbumListPhotoAggregates(prisma, candidateIds, user.id);

    const filteredAlbums = albums
      .filter((album) => album.userId !== user.id)
      .map((album) => {
        const agg = aggregates.get(album.id) ?? {
          photosCount: 0,
          myPhotosCount: 0,
          hasOtherContributors: false,
        };

        return {
          id: album.id,
          title: album.title,
          location: album.location,
          eventDate: album.eventDate,
          createdAt: album.createdAt,
          creatorName: album.user?.name || "Fotógrafo",
          photosCount: agg.photosCount,
          myPhotosCount: agg.myPhotosCount,
          hasMyPhotos: agg.myPhotosCount > 0,
        };
      });

    return NextResponse.json({ albums: filteredAlbums });
  } catch (err: any) {
    console.error("GET /api/dashboard/albums/search ERROR >>>", err);
    return NextResponse.json(
      { error: "Error buscando álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
