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
 * Lista global (sin filtrar por fotógrafo):
 * - AlbumInterest (tipo "interesado")
 * - AlbumNotification sin par AlbumInterest duplicado (mismo albumId + email) (tipo "aviso")
 *
 * Solo rol ADMIN.
 */
export async function GET(_req: NextRequest) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const albumScope = { isHidden: false };

    const interests = await prisma.albumInterest.findMany({
      where: { album: albumScope },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
        firstName: true,
        whatsapp: true,
        createdAt: true,
        hasPurchased: true,
        selfieKey: true,
        biometricDeletedAt: true,
        albumId: true,
        album: {
          select: {
            id: true,
            title: true,
            publicSlug: true,
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

    const notifications = await prisma.albumNotification.findMany({
      where: { album: albumScope },
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

    const interestKeySet = new Set(
      interests.map((i) => `${i.albumId}:${i.email.toLowerCase()}`),
    );

    const interestRows: InteresadoRow[] = interests.map((i) => {
      const hasSelfie = Boolean(i.selfieKey && !i.biometricDeletedAt);
      return {
        tipo: "interesado",
        id: i.id,
        email: i.email,
        name: i.name ?? null,
        lastName: i.lastName ?? null,
        firstName: i.firstName ?? null,
        whatsapp: i.whatsapp ?? null,
        createdAt: i.createdAt.toISOString(),
        hasPurchased: i.hasPurchased,
        albumId: i.album.id,
        albumTitle: i.album.title,
        albumPublicSlug: i.album.publicSlug,
        photographerId: i.album.user.id,
        photographerEmail: i.album.user.email ?? null,
        photographerName: i.album.user.name ?? null,
        hasSelfie,
        interestId: i.id,
      };
    });

    const notificationRows: InteresadoRow[] = notifications
      .filter((n) => !interestKeySet.has(`${n.albumId}:${n.email.toLowerCase()}`))
      .map((n) => ({
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
        hasSelfie: false,
      }));

    const rows = [...interestRows, ...notificationRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

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
