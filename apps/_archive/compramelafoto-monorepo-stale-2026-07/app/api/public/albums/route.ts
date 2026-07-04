import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key, normalizePreviewUrl } from "@/lib/r2-client";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export const dynamic = "force-dynamic";

// GET: Obtener todos los álbumes públicos ordenados por fecha de evento
export async function GET() {
  try {
    let albums: any[];

    try {
      // Intentar obtener con coverPhoto y filtro isRemoved
      albums = await prisma.album.findMany({
        where: {
          isHidden: false,
          isPublic: true,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              companyName: true,
              logoUrl: true,
              publicPageHandler: true,
            },
          },
          photos: {
            where: {
              isRemoved: false,
            },
            select: {
              id: true,
              originalKey: true,
              previewUrl: true,
              isRemoved: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          coverPhoto: {
            select: {
              id: true,
              originalKey: true,
              previewUrl: true,
            },
          },
        },
        orderBy: [
          { eventDate: "desc" }, // Primero por fecha de evento (más recientes primero)
          { createdAt: "desc" }, // Luego por fecha de creación
        ],
      });
    } catch (dbErr: any) {
      // Si falla por coverPhotoId o isRemoved, intentar sin esos campos
      const errorMsg = String(dbErr?.message ?? "");
      if (errorMsg.includes("coverPhotoId") || errorMsg.includes("coverPhoto") || errorMsg.includes("isRemoved") || errorMsg.includes("Unknown field") || errorMsg.includes("does not exist")) {
        console.warn("GET /api/public/albums: usando query de respaldo (coverPhotoId o isRemoved pueden no existir)");
        try {
          albums = await prisma.album.findMany({
            where: {
              isHidden: false,
              isPublic: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                  logoUrl: true,
                  publicPageHandler: true,
                },
              },
              photos: {
                select: {
                  id: true,
                  originalKey: true,
                  previewUrl: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
            orderBy: [
              { eventDate: "desc" },
              { createdAt: "desc" },
            ],
          });
        } catch (fallbackErr: any) {
          // Si aún falla, intentar sin coverPhoto
          console.warn("GET /api/public/albums: usando query mínima sin coverPhoto");
          albums = await prisma.album.findMany({
            where: {
              isHidden: false,
              isPublic: true,
            },
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  companyName: true,
                  logoUrl: true,
                  publicPageHandler: true,
                },
              },
              photos: {
                select: {
                  id: true,
                  originalKey: true,
                  previewUrl: true,
                },
                orderBy: {
                  createdAt: "asc",
                },
                take: 1, // Solo necesitamos la primera para la portada
              },
            },
            orderBy: [
              { eventDate: "desc" },
              { createdAt: "desc" },
            ],
          });
        }
      } else {
        throw dbErr;
      }
    }

    // Formatear los álbumes para la respuesta
    const normalizeLogoUrl = (logoUrl: string | null | undefined): string | null => {
      if (!logoUrl) return null;
      if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
        if (!logoUrl.includes("localhost") && !logoUrl.includes("127.0.0.1")) {
          return logoUrl;
        }
        return getR2PublicUrl(urlToR2Key(logoUrl));
      }
      const key = logoUrl.replace(/^\//, "");
      return getR2PublicUrl(key);
    };

    const publicAlbums = albums.filter((album) => isAlbumPubliclyAccessible(album));

    const isDev = process.env.NODE_ENV === "development";

    const albumsFormatted = publicAlbums.map((album) => {
      // Filtrar fotos no removidas para reutilizar
      const availablePhotos = album.photos && Array.isArray(album.photos)
        ? album.photos.filter((photo: any) => photo.isRemoved !== true)
        : [];
      const firstPhoto = availablePhotos.length > 0 ? availablePhotos[0] : null;
      // Para thumbnails del home: preferir previewUrl (baja res) sobre originalKey (alta res)
      const firstPhotoThumbUrl = firstPhoto
        ? (normalizePreviewUrl(firstPhoto.previewUrl, firstPhoto.originalKey) ?? (firstPhoto.originalKey ? getR2PublicUrl(firstPhoto.originalKey) : null))
        : null;

      // Intentar obtener la portada para thumbnail: priorizar versiones en baja resolución
      let coverPhotoUrl: string | null = null;

      // Prioridad 1: thumbnail recortado del álbum (óptimo para grid)
      if (album.coverThumbnailKey) {
        coverPhotoUrl = getR2PublicUrl(album.coverThumbnailKey);
        if (isDev) console.log(`Album ${album.id} (${album.title}): usando coverThumbnailKey -> ${coverPhotoUrl}`);
      }
      // Prioridad 2: coverPhoto - preferir preview (baja res) sobre original
      else if (album.coverPhoto) {
        const coverPrev = normalizePreviewUrl(album.coverPhoto.previewUrl, album.coverPhoto.originalKey);
        coverPhotoUrl = coverPrev ?? (album.coverPhoto.originalKey ? getR2PublicUrl(album.coverPhoto.originalKey) : null);
        if (isDev) console.log(`Album ${album.id} (${album.title}): usando coverPhoto (preview) -> ${coverPhotoUrl}`);
      }
      // Prioridad 3: primera foto del album (preview)
      else if (firstPhotoThumbUrl) {
        coverPhotoUrl = firstPhotoThumbUrl;
        if (isDev) console.log(`Album ${album.id} (${album.title}): usando primera foto (preview)`);
      }

      // Fallback para cuando la portada devuelve 404 en R2 (ej. archivo borrado): usar primera foto
      const coverPhotoUrlFallback = coverPhotoUrl && firstPhotoThumbUrl && coverPhotoUrl !== firstPhotoThumbUrl ? firstPhotoThumbUrl : null;

      const photosCount = album.photos && Array.isArray(album.photos)
        ? album.photos.filter((photo: any) => !photo.isRemoved).length
        : 0;

      return {
        id: album.id,
        title: album.title,
        location: album.location,
        eventDate: album.eventDate,
        publicSlug: album.publicSlug,
        createdAt: album.createdAt,
        photosCount,
        coverPhotoUrl,
        coverPhotoUrlFallback: coverPhotoUrlFallback || undefined,
        showComingSoonMessage: album.showComingSoonMessage || false,
        photographer: {
          id: album.user.id,
          name: album.user.name,
          companyName: album.user.companyName,
          logoUrl: normalizeLogoUrl(album.user.logoUrl),
          handler: album.user.publicPageHandler,
        },
      };
    });

    return NextResponse.json(albumsFormatted);
  } catch (err: any) {
    console.error("GET /api/public/albums ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo álbumes", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
