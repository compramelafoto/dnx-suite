import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseGrantCookie, HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/albums/[id]/hidden/check-grant
 * Verifica si el visitante tiene un grant vigente (cookie) para ver fotos del álbum oculto.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: { id: true, userId: true, hiddenPhotosEnabled: true },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    if (!album.hiddenPhotosEnabled) {
      return NextResponse.json({ hasGrant: true, allowedPhotoIds: null }); // No requiere verificación
    }

    const authUser = await getAuthUser();
    if (authUser) {
      const isOwner = authUser.id === album.userId;
      const isAdmin = authUser.role === Role.ADMIN;
      const hasAccess = await prisma.albumAccess.findUnique({
        where: { albumId_userId: { albumId, userId: authUser.id } },
      });
      if (isOwner || isAdmin || hasAccess) {
        // Dueño/admin/colaborador ven todas las fotos (no se envía allowedPhotoIds = filtrar todas)
        return NextResponse.json({ hasGrant: true, allowedPhotoIds: null });
      }
    }

    const grantCookie = req.cookies.get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
    const parsed = parseGrantCookie(grantCookie);
    if (!parsed || parsed.albumId !== albumId) {
      return NextResponse.json({ hasGrant: false });
    }

    const grant = await prisma.hiddenAlbumGrant.findUnique({
      where: { id: parsed.grantId },
      select: { albumId: true, expiresAt: true, isRevoked: true, allowedPhotoIds: true },
    });

    if (
      !grant ||
      grant.albumId !== albumId ||
      grant.isRevoked ||
      grant.expiresAt < new Date()
    ) {
      return NextResponse.json({ hasGrant: false });
    }

    const allowedIds = Array.isArray(grant.allowedPhotoIds) ? grant.allowedPhotoIds : [];
    return NextResponse.json({ hasGrant: true, allowedPhotoIds: allowedIds });
  } catch (err: any) {
    console.error("GET /api/albums/[id]/hidden/check-grant ERROR:", err);
    return NextResponse.json({ hasGrant: false });
  }
}
