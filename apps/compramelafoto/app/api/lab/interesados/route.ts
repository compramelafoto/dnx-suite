import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

/**
 * GET /api/lab/interesados
 * Devuelve los interesados en álbumes que tienen este laboratorio seleccionado
 */
export async function GET(req: NextRequest) {
  try {
    const { error, user } = await requireAuth([Role.LAB, Role.LAB_PHOTOGRAPHER]);

    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener laboratorio
    const lab = await prisma.lab.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!lab) {
      return NextResponse.json(
        { error: "Laboratorio no encontrado" },
        { status: 404 }
      );
    }

    // Obtener álbumes que tienen este laboratorio seleccionado
    const albums = await prisma.album.findMany({
      where: {
        selectedLabId: lab.id,
        isHidden: false,
      },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        interests: {
          select: {
            id: true,
            email: true,
            name: true,
            lastName: true,
            whatsapp: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        notifications: {
          select: {
            id: true,
            email: true,
            name: true,
            lastName: true,
            whatsapp: true,
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

    // Formatear datos - combinar intereses y notificaciones
    const interesados = albums
      .filter((album) => album.interests.length > 0 || album.notifications.length > 0)
      .map((album) => {
        // Combinar intereses y notificaciones
        const allInterested = [
          ...album.interests.map((i) => ({
            id: i.id,
            type: "interest" as const,
            email: i.email,
            name: i.name || "",
            lastName: i.lastName || "",
            whatsapp: i.whatsapp || "",
            createdAt: i.createdAt.toISOString(),
          })),
          ...album.notifications.map((n) => ({
            id: n.id,
            type: "notification" as const,
            email: n.email,
            name: n.name || "",
            lastName: n.lastName || "",
            whatsapp: n.whatsapp || "",
            createdAt: n.createdAt.toISOString(),
          })),
        ];

        return {
          albumId: album.id,
          albumTitle: album.title,
          albumSlug: album.publicSlug,
          albumCreatedAt: album.createdAt.toISOString(),
          photographerId: album.user.id,
          photographerName: album.user.name || album.user.email,
          photographerEmail: album.user.email,
          interesados: allInterested,
          totalInteresados: allInterested.length,
        };
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
