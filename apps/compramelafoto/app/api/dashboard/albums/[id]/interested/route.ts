import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/albums/[id]/interested
 * Lista interesados del álbum (solo dueño o ADMIN)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER, Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, userId: true },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (album.userId !== user.id && user.role !== Role.ADMIN) {
      return NextResponse.json({ error: "No tenés permiso para ver los interesados de este álbum" }, { status: 403 });
    }

    const interested = await prisma.albumInterest.findMany({
      where: { albumId },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        whatsapp: true,
        createdAt: true,
        expiresAt: true,
        faceId: true,
        selfieKey: true,
        biometricDeletedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      interested.map((i) => ({
        id: i.id,
        email: i.email,
        name: i.name,
        lastName: i.lastName,
        whatsapp: i.whatsapp,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        hasBiometric: !!(i.faceId || i.selfieKey) && !i.biometricDeletedAt,
        hasSelfie: !!i.selfieKey && !i.biometricDeletedAt,
      }))
    );
  } catch (err: any) {
    console.error("Error en GET /api/dashboard/albums/[id]/interested:", err);
    return NextResponse.json(
      { error: err?.message || "Error obteniendo interesados" },
      { status: 500 }
    );
  }
}
