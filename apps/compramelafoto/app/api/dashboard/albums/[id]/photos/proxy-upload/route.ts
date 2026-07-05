import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { ensureAlbumUploadAccess, ensureMpConnected, isPhotoFolderValidationError, resolvePhotoUploadFolders } from "../upload-helpers";
import { finalizeAlbumPhotoFromRaw } from "@/lib/albums/finalize-album-photo-from-raw";
import {
  ALBUM_PHOTO_ALLOWED_TYPES,
  ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES,
  getAlbumPhotoMaxBytes,
  getAlbumPhotoMaxMb,
} from "@/lib/albums/album-photo-upload-limits";
import {
  logAlbumPhotoUploadIssue,
  resolveAlbumPhotoContentType,
} from "@/lib/albums/album-photo-content-type";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";
import { isAsyncAlbumPhotoIngestEnabled } from "@/lib/albums/album-photo-ingest-feature-flag";
import { enqueueAlbumPhotoIngest } from "@/lib/albums/enqueue-album-photo-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Subida alternativa: el archivo pasa por el servidor (sin PUT directo a R2 desde el navegador).
 * Evita errores de CORS cuando el bucket no permite PUT desde el origen de la app.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || typeof (file as Blob).arrayBuffer !== "function") {
      return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
    }

    const uploadFile = file as File;
    const contentType = resolveAlbumPhotoContentType(
      uploadFile.name || "archivo",
      uploadFile.type
    );
    const size = uploadFile.size;

    if (!contentType || !size) {
      logAlbumPhotoUploadIssue({
        phase: "proxy",
        filename: uploadFile.name || "archivo",
        sizeBytes: size,
        contentType: contentType || "(vacío)",
        error: "archivo_invalido",
        albumId,
      });
      return NextResponse.json({ error: "Archivo inválido" }, { status: 400 });
    }

    if (!ALBUM_PHOTO_ALLOWED_TYPES.has(contentType)) {
      logAlbumPhotoUploadIssue({
        phase: "proxy",
        filename: uploadFile.name || "archivo",
        sizeBytes: size,
        contentType,
        error: "formato_no_soportado",
        albumId,
      });
      return NextResponse.json({ error: "Formato no soportado" }, { status: 400 });
    }

    const maxBytes = getAlbumPhotoMaxBytes();
    const maxMb = getAlbumPhotoMaxMb();
    if (size > maxBytes) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${maxMb}MB.` },
        { status: 400 }
      );
    }

    if (size > ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Para fotos mayores a ${Math.round(ALBUM_PHOTO_PROXY_UPLOAD_MAX_BYTES / 1024 / 1024)} MB usá la subida directa (requiere almacenamiento configurado).`,
        },
        { status: 413 }
      );
    }

    let resolvedFolders: { eventFolderId?: number; folderId?: number } = {};
    try {
      resolvedFolders = await resolvePhotoUploadFolders({
        albumId,
        albumEventId: access.albumEventId,
        userId: user.id,
        eventFolderIdRaw: formData.get("eventFolderId"),
        folderIdRaw: formData.get("folderId"),
        relativePathRaw: formData.get("relativePath"),
      });
    } catch (e: unknown) {
      if (isPhotoFolderValidationError(e)) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    const originalName = uploadFile.name || "archivo";
    const key = generateR2Key(originalName, `albums/${albumId}/raw`);
    const buffer = Buffer.from(await uploadFile.arrayBuffer());

    await uploadToR2(buffer, key, contentType);

    if (isAsyncAlbumPhotoIngestEnabled()) {
      const { job, created } = await enqueueAlbumPhotoIngest({
        userId: user.id,
        albumId,
        rawKey: key,
        originalFilename: originalName,
        filesizeBytes: size,
        eventFolderId: resolvedFolders.eventFolderId ?? null,
        folderId: resolvedFolders.folderId ?? null,
      });

      return NextResponse.json(
        {
          jobId: job.id,
          status: job.status,
          async: true,
        },
        { status: created ? 202 : 200 }
      );
    }

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
    console.error("POST proxy-upload ERROR >>>", err);
    return NextResponse.json(
      {
        error: "Error procesando foto",
        detail: String((err as { message?: string })?.message ?? err),
      },
      { status: 500 }
    );
  }
}
