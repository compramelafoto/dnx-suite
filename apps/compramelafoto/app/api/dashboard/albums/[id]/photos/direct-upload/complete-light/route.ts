import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import {
  ensureAlbumUploadAccess,
  ensureMpConnected,
  isPhotoFolderValidationError,
  resolvePhotoUploadFolders,
} from "../../upload-helpers";
import { enqueueAlbumPhotoIngest } from "@/lib/albums/enqueue-album-photo-ingest";
import { isAsyncAlbumPhotoIngestEnabled } from "@/lib/albums/album-photo-ingest-feature-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST .../direct-upload/complete-light
 * Confirma que el raw está en R2 y encola procesamiento (sin Sharp en este request).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    if (!isAsyncAlbumPhotoIngestEnabled()) {
      return NextResponse.json(
        { error: "La ingesta async no está habilitada en el servidor." },
        { status: 503 }
      );
    }

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

    const originalName = String(body?.originalName || "").trim() || null;
    const filesizeBytes =
      body?.size != null && Number.isFinite(Number(body.size))
        ? Math.round(Number(body.size))
        : null;

    const { job, created } = await enqueueAlbumPhotoIngest({
      userId: user.id,
      albumId,
      rawKey: key,
      originalFilename: originalName,
      filesizeBytes,
      eventFolderId: resolvedFolders.eventFolderId ?? null,
      folderId: resolvedFolders.folderId ?? null,
    });

    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
        created,
        async: true,
      },
      { status: created ? 202 : 200 }
    );
  } catch (err: unknown) {
    console.error("POST direct-upload complete-light ERROR >>>", err);
    return NextResponse.json(
      {
        error: "No se pudo encolar la foto",
        detail: String((err as { message?: string })?.message ?? err),
      },
      { status: 500 }
    );
  }
}
