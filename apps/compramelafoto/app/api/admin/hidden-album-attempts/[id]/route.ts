import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/hidden-album-attempts/[id]
 * Detalle de un intento de selfie. Solo ADMIN.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id } = await Promise.resolve(params);
    const attempt = await prisma.hiddenAlbumAttempt.findUnique({
      where: { id },
      include: {
        album: { select: { id: true, title: true, publicSlug: true, hiddenPhotosEnabled: true } },
        grant: true,
      },
    });

    if (!attempt) {
      return NextResponse.json({ error: "Intento no encontrado" }, { status: 404 });
    }

    const userDetail =
      attempt.userId != null
        ? await prisma.user.findUnique({
            where: { id: attempt.userId },
            select: { id: true, email: true, name: true },
          })
        : null;

    const allowedPhotoIds = (attempt.grant?.allowedPhotoIds as number[] | null) ?? [];
    const photos =
      allowedPhotoIds.length > 0
        ? await prisma.photo.findMany({
            where: { id: { in: allowedPhotoIds }, isRemoved: false },
            select: { id: true, previewUrl: true, originalKey: true },
          })
        : [];

    return NextResponse.json({
      ...attempt,
      createdAt: attempt.createdAt.toISOString(),
      selfieExpiresAt: attempt.selfieExpiresAt?.toISOString() ?? null,
      user: userDetail,
      grant: attempt.grant
        ? {
            ...attempt.grant,
            createdAt: attempt.grant.createdAt.toISOString(),
            expiresAt: attempt.grant.expiresAt.toISOString(),
            allowedPhotoIds,
          }
        : null,
      photosForThumbnails: photos,
    });
  } catch (err: any) {
    console.error("Error obteniendo detalle attempt:", err);
    return NextResponse.json(
      { error: "Error al obtener detalle" },
      { status: 500 }
    );
  }
}
