import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

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

    // Buscar álbumes con el mismo título (case-insensitive, exacto o muy similar)
    const searchTitle = title.trim();
    
    const albums = await prisma.album.findMany({
      where: {
        title: {
          equals: searchTitle,
          mode: "insensitive",
        },
        isPublic: true, // Solo álbumes públicos pueden ser colaborativos
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
        photos: {
          select: {
            id: true,
            userId: true,
          },
        },
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

    // Filtrar para no mostrar álbumes que ya pertenecen al usuario actual
    const filteredAlbums = albums
      .filter((album) => album.userId !== user.id)
      .map((album) => {
        const photosCount = album.photos.length;
        const myPhotosCount = album.photos.filter((p) => p.userId === user.id).length;
        const hasMyPhotos = myPhotosCount > 0;
        
        return {
          id: album.id,
          title: album.title,
          location: album.location,
          eventDate: album.eventDate,
          createdAt: album.createdAt,
          creatorName: album.user?.name || "Fotógrafo",
          photosCount,
          myPhotosCount,
          hasMyPhotos, // Si ya tiene fotos del usuario, ya está colaborando
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
