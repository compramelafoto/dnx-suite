import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getR2PublicUrl, urlToR2Key } from "@/lib/r2-client";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import {
  buildAlbumListCoverUrls,
  countActiveAlbumPhotos,
} from "@/lib/album/album-list-cover";
import { albumIdsWithPublicReadyVideos } from "@/lib/videos/album-media-type-flags";

export const dynamic = "force-dynamic";

const publicAlbumListWhere = {
  isHidden: false,
  isPublic: true,
  isTest: false,
} as const;

// GET: Obtener todos los álbumes públicos ordenados por fecha de evento
export async function GET() {
  try {
    let albums: any[];

    try {
      // Intentar obtener con coverPhoto y filtro isRemoved
      albums = await prisma.album.findMany({
        where: publicAlbumListWhere,
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
            where: publicAlbumListWhere,
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
            where: publicAlbumListWhere,
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
    const publicAlbumIds = publicAlbums.map((album) => album.id as number);
    const albumsWithPublicVideos = await albumIdsWithPublicReadyVideos(prisma, publicAlbumIds);

    const isDev = process.env.NODE_ENV === "development";

    const albumsFormatted = publicAlbums.map((album) => {
      const photosCount = countActiveAlbumPhotos(album.photos);
      const { coverPhotoUrl, coverPhotoUrlFallback } = buildAlbumListCoverUrls({
        id: album.id,
        coverPhotoId: (album as { coverPhotoId?: number | null }).coverPhotoId ?? null,
        coverThumbnailKey: album.coverThumbnailKey,
        coverPhoto: album.coverPhoto,
        photos: album.photos,
      });

      if (isDev && photosCount > 0 && !coverPhotoUrl) {
        console.warn(`[public/albums] álbum ${album.id} con fotos sin URL de portada`);
      }

      return {
        id: album.id,
        title: album.title,
        location: album.location,
        eventDate: album.eventDate,
        publicSlug: album.publicSlug,
        createdAt: album.createdAt,
        photosCount,
        hasPhotos: photosCount > 0,
        showComingSoonMessage: photosCount <= 0,
        hasVideos: albumsWithPublicVideos.has(album.id),
        coverPhotoUrl,
        coverPhotoUrlFallback: coverPhotoUrlFallback || undefined,
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
