import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type InteresadoRow = {
  tipo: "interesado" | "aviso";
  id: number;
  email: string;
  name: string | null;
  lastName: string | null;
  firstName: string | null;
  whatsapp: string | null;
  createdAt: string;
  hasPurchased?: boolean;
  albumId: number;
  albumTitle: string;
  albumPublicSlug: string;
  photographerId: number;
  photographerEmail: string | null;
  photographerName: string | null;
  hasSelfie?: boolean;
  interestId?: number;
};

/**
 * GET /api/admin/interesados
 * Lista quienes pidieron ser avisados cuando el álbum esté listo (AlbumNotification).
 * Es la única acción del usuario: completa nombre, email y WhatsApp en el álbum;
 * el sistema lo guarda en AlbumNotification (y también en AlbumInterest para emails de recordatorio).
 */
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const notifications = await prisma.albumNotification.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        whatsapp: true,
        createdAt: true,
        albumId: true,
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
            userId: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const interestPairs = notifications.map((n) => ({ albumId: n.albumId, email: n.email }));
    const interests = await prisma.albumInterest.findMany({
      where: {
        OR: interestPairs.map((p) => ({ albumId: p.albumId, email: p.email })),
      },
      select: {
        id: true,
        albumId: true,
        email: true,
        selfieKey: true,
        biometricDeletedAt: true,
      },
    });
    const interestMap = new Map<string, (typeof interests)[0]>();
    interests.forEach((i) => {
      interestMap.set(`${i.albumId}:${i.email.toLowerCase()}`, i);
    });

    const rows: InteresadoRow[] = notifications.map((n) => {
      const key = `${n.albumId}:${n.email.toLowerCase()}`;
      const interest = interestMap.get(key);
      const hasSelfie = !!interest?.selfieKey && !interest?.biometricDeletedAt;
      return {
        tipo: "aviso",
        id: n.id,
        email: n.email,
        name: n.name ?? null,
        lastName: n.lastName ?? null,
        firstName: null,
        whatsapp: n.whatsapp ?? null,
        createdAt: n.createdAt.toISOString(),
        albumId: n.album.id,
        albumTitle: n.album.title,
        albumPublicSlug: n.album.publicSlug,
        photographerId: n.album.user.id,
        photographerEmail: n.album.user.email ?? null,
        photographerName: n.album.user.name ?? null,
        hasSelfie,
        interestId: interest?.id,
      };
    });

    return NextResponse.json({ rows });
  } catch (err: unknown) {
    console.error("GET /api/admin/interesados ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error obteniendo interesados",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
