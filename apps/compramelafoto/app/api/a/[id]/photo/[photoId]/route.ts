import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizePreviewUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: Obtener información de un álbum y una foto específica para la página de remoción
export async function GET(
  req: Request,
  ctx: { params: { id: string; photoId: string } } | { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const params = await Promise.resolve(ctx.params);
    const slugOrId = params.id;
    const photoId = Number.parseInt(params.photoId, 10);

    if (!Number.isFinite(photoId)) {
      return NextResponse.json({ error: "ID de foto inválido" }, { status: 400 });
    }

    let album: any = null;

    // Intentar buscar por publicSlug primero
    try {
      album = await prisma.album.findUnique({
        where: { publicSlug: slugOrId },
        select: {
          id: true,
          userId: true,
          title: true,
          location: true,
          eventDate: true,
          photos: {
            where: {
              id: photoId,
              // Intentar incluir isRemoved si existe, si no, ignorar
            },
            select: {
              id: true,
              previewUrl: true,
              originalKey: true,
            },
            take: 1,
          },
        },
      });
    } catch (err: any) {
      // Si falla por campo desconocido, intentar sin isRemoved
      if (err?.message?.includes("isRemoved") || err?.message?.includes("Unknown")) {
        try {
          album = await prisma.album.findUnique({
            where: { publicSlug: slugOrId },
            select: {
              id: true,
              userId: true,
              title: true,
              location: true,
              eventDate: true,
              photos: {
                where: {
                  id: photoId,
                },
                select: {
                  id: true,
                  previewUrl: true,
                  originalKey: true,
                },
                take: 1,
              },
            },
          });
        } catch (secondErr: any) {
          console.error("Error buscando álbum:", secondErr);
        }
      }
    }

    // Si no se encontró por publicSlug, intentar por ID numérico
    if (!album) {
      const albumId = Number.parseInt(slugOrId, 10);
      if (Number.isFinite(albumId)) {
        try {
          album = await prisma.album.findUnique({
            where: { id: albumId },
            select: {
              id: true,
              userId: true,
              title: true,
              location: true,
              eventDate: true,
              photos: {
                where: {
                  id: photoId,
                },
                select: {
                  id: true,
                  previewUrl: true,
                  originalKey: true,
                },
                take: 1,
              },
            },
          });
        } catch (err: any) {
          console.error("Error buscando álbum por ID:", err);
        }
      }
    }

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (!album.photos || album.photos.length === 0) {
      return NextResponse.json({ error: "Foto no encontrada en este álbum" }, { status: 404 });
    }

    const photo = album.photos[0];
    // Normalizar previewUrl para asegurar que sea una URL absoluta
    const normalizedPhoto = {
      ...photo,
      previewUrl: normalizePreviewUrl(photo.previewUrl, photo.originalKey) || photo.previewUrl,
    };

    return NextResponse.json({
      album: {
        id: album.id,
        title: album.title,
        location: album.location,
        eventDate: album.eventDate,
      },
      photo: normalizedPhoto,
    });
  } catch (err: any) {
    console.error("GET /api/a/[id]/photo/[photoId] ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo datos", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
