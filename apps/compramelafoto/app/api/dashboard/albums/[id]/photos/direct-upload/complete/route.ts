import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { ensureAlbumUploadAccess, ensureMpConnected, isPhotoFolderValidationError, resolvePhotoUploadFolders } from "../../upload-helpers";
import { finalizeAlbumPhotoFromRaw } from "@/lib/albums/finalize-album-photo-from-raw";
import { getAlbumPhotoMaxBytes, getAlbumPhotoMaxMb } from "@/lib/albums/album-photo-upload-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol PHOTOGRAPHER." },
        { status: 401 }
      );
    }

    const mpCheck = await ensureMpConnected(user);
    if (!mpCheck.ok) {
      return NextResponse.json({ error: mpCheck.error }, { status: 403 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const key = String(body?.key || "");

    if (!key || !key.startsWith(`albums/${albumId}/raw/`)) {
      return NextResponse.json({ error: "Key inválida" }, { status: 400 });
    }

    let resolvedFolders: { eventFolderId?: number; folderId?: number } = {};
    try {
      resolvedFolders = await resolvePhotoUploadFolders({
        albumId,
        albumEventId: access.albumEventId,
        userId: user.id,
        eventFolderIdRaw: body?.eventFolderId,
        folderIdRaw: body?.folderId,
        relativePathRaw: body?.relativePath,
      });
    } catch (e: unknown) {
      if (isPhotoFolderValidationError(e)) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const maxBytes = getAlbumPhotoMaxBytes();
    const maxMb = getAlbumPhotoMaxMb();

    const result = await finalizeAlbumPhotoFromRaw({
      albumId,
      userId: user.id,
      key,
      eventFolderId: resolvedFolders.eventFolderId,
      folderId: resolvedFolders.folderId,
      maxBytes,
      maxMb,
    });

    return NextResponse.json({ photo: result.photo }, { status: 201 });
  } catch (err: unknown) {
    console.error("POST direct-upload complete ERROR >>>", err);
    return NextResponse.json(
      { error: "Error procesando foto", detail: String((err as { message?: string })?.message ?? err) },
      { status: 500 }
    );
  }
}
