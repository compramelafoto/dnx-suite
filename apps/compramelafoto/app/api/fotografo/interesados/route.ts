import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/fotografo/interesados
 * Devuelve todos los interesados en los álbumes del fotógrafo
 * Incluye tanto AlbumNotification como AlbumInterest
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      console.error("GET /api/fotografo/interesados: No autorizado", { error });
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    console.log("GET /api/fotografo/interesados: Usuario autenticado", { userId: user.id, role: user.role });

    // Debug: Verificar si hay notificaciones e intereses en la base de datos
    try {
      const allNotifications = await prisma.albumNotification.findMany({
        where: {
          album: {
            userId: user.id,
          },
        },
        select: {
          id: true,
          albumId: true,
          email: true,
        },
      });
      const allInterests = await prisma.albumInterest.findMany({
        where: {
          album: {
            userId: user.id,
          },
        },
        select: {
          id: true,
          albumId: true,
          email: true,
        },
      });
      console.log("GET /api/fotografo/interesados: Debug - Notificaciones e intereses encontrados", {
        totalNotifications: allNotifications.length,
        totalInterests: allInterests.length,
        notifications: allNotifications,
        interests: allInterests,
      });
    } catch (debugErr) {
      console.warn("GET /api/fotografo/interesados: Error en consulta de debug", debugErr);
    }

    // Obtener álbumes del fotógrafo con sus notificaciones e intereses
    let albums: any[];
    
    try {
      // Intentar con los nuevos campos primero
      albums = await prisma.album.findMany({
        where: {
          userId: user.id,
          isHidden: false,
        },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          createdAt: true,
          notifications: {
            select: {
              id: true,
              name: true,
              lastName: true,
              whatsapp: true,
              email: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
          interests: {
            select: {
              id: true,
              name: true,
              lastName: true,
              whatsapp: true,
              email: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (dbErr: any) {
      // Si falla por campos desconocidos, intentar sin lastName y whatsapp
      const errorMsg = String(dbErr?.message ?? "");
      if (errorMsg.includes("lastName") || errorMsg.includes("whatsapp") || errorMsg.includes("Unknown field")) {
        console.warn("GET /api/fotografo/interesados: campos lastName/whatsapp no existen, usando query básica");
        albums = await prisma.album.findMany({
          where: {
            userId: user.id,
            isHidden: false,
          },
          select: {
            id: true,
            title: true,
            publicSlug: true,
            createdAt: true,
            notifications: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
            interests: {
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
              },
              orderBy: {
                createdAt: "desc",
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });
      } else {
        throw dbErr;
      }
    }

    console.log("GET /api/fotografo/interesados: Álbumes encontrados", { 
      totalAlbums: albums.length,
      albumsWithNotifications: albums.filter(a => a.notifications.length > 0).length,
      albumsWithInterests: albums.filter(a => a.interests.length > 0).length,
    });

    // Combinar notificaciones e intereses en una lista unificada
    const interesados = albums
      .filter((album) => album.notifications.length > 0 || album.interests.length > 0)
      .map((album) => {
        // Combinar notificaciones e intereses
        const allInterested = [
          ...album.notifications.map((n: any) => ({
            id: n.id,
            type: "notification" as const,
            name: n.name || "",
            lastName: (n.lastName !== undefined && n.lastName !== null) ? String(n.lastName) : "",
            whatsapp: (n.whatsapp !== undefined && n.whatsapp !== null) ? String(n.whatsapp) : "",
            email: n.email || "",
            createdAt: n.createdAt.toISOString(),
          })),
          ...album.interests.map((i: any) => ({
            id: i.id,
            type: "interest" as const,
            name: i.name || "",
            lastName: (i.lastName !== undefined && i.lastName !== null) ? String(i.lastName) : "",
            whatsapp: (i.whatsapp !== undefined && i.whatsapp !== null) ? String(i.whatsapp) : "",
            email: i.email || "",
            createdAt: i.createdAt.toISOString(),
          })),
        ];

        const seen = new Set<string>();
        const dedupedInterested = allInterested.filter((item) => {
          const emailKey = String(item.email || "").trim().toLowerCase();
          const key = emailKey ? `email:${emailKey}` : `${item.type}:${item.id}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        return {
          albumId: album.id,
          albumTitle: album.title,
          albumSlug: album.publicSlug,
          albumCreatedAt: album.createdAt.toISOString(),
          interesados: dedupedInterested,
          totalInteresados: dedupedInterested.length,
        };
      });

    console.log("GET /api/fotografo/interesados: Interesados formateados", { 
      totalInteresados: interesados.length,
      totalPersonas: interesados.reduce((sum, item) => sum + item.totalInteresados, 0)
    });

    return NextResponse.json(interesados);
  } catch (error: any) {
    console.error("Error obteniendo interesados:", error);
    return NextResponse.json(
      { error: "Error obteniendo interesados", detail: error.message },
      { status: 500 }
    );
  }
}
