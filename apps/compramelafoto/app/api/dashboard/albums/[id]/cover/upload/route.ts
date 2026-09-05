import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { uploadToR2, generateR2Key, deleteFromR2, getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
/** Límite conservador: el body de una función serverless no llega a 4,5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;
const OUTPUT_SIZE = 1200;
const COVER_PREFIX = "album-covers/";

type AlbumCoverRow = {
  id: number;
  coverPhotoId: number | null;
  coverThumbnailKey: string | null;
};

/** Portada propia: imagen sin foto asociada. Solo esas se borran de R2 al reemplazar. */
function standaloneKeyToDelete(album: AlbumCoverRow): string | null {
  if (album.coverPhotoId != null) return null;
  const key = album.coverThumbnailKey?.trim();
  if (!key || !key.startsWith(COVER_PREFIX)) return null;
  return key;
}

async function loadOwnedAlbum(albumId: number, userId: number): Promise<AlbumCoverRow | null> {
  const album = await prisma.album.findFirst({
    where: { id: albumId, userId },
    select: { id: true, coverPhotoId: true, coverThumbnailKey: true },
  });
  return album as AlbumCoverRow | null;
}

/**
 * POST /api/dashboard/albums/[id]/cover/upload
 * Sube una portada propia del álbum (no es una foto del álbum: no se vende,
 * no aparece en la galería y no desactiva el cartel "fotos próximamente").
 * FormData: file (imagen) + cropArea opcional (JSON con x/y/width/height en %).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await loadOwnedAlbum(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.arrayBuffer) {
      return NextResponse.json({ error: "Falta el archivo (file)" }, { status: 400 });
    }

    const contentType = (file.type || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá JPG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 4 MB." },
        { status: 400 }
      );
    }

    let cropArea: { x: number; y: number; width: number; height: number } | null = null;
    const rawCrop = formData.get("cropArea");
    if (typeof rawCrop === "string" && rawCrop.trim()) {
      try {
        const parsed = JSON.parse(rawCrop);
        if (parsed && typeof parsed === "object") {
          cropArea = {
            x: Number(parsed.x) || 0,
            y: Number(parsed.y) || 0,
            width: Number(parsed.width) || 0,
            height: Number(parsed.height) || 0,
          };
        }
      } catch {
        cropArea = null;
      }
    }

    const raw = Buffer.from(await file.arrayBuffer());

    let processed: Buffer;
    try {
      let pipeline = sharp(raw).rotate();

      if (cropArea && cropArea.width > 0 && cropArea.height > 0) {
        const meta = await sharp(raw).rotate().metadata();
        const width = meta.width || 0;
        const height = meta.height || 0;
        if (width > 0 && height > 0) {
          const left = Math.max(0, Math.round((cropArea.x * width) / 100));
          const top = Math.max(0, Math.round((cropArea.y * height) / 100));
          const cropWidth = Math.max(1, Math.round((cropArea.width * width) / 100));
          const cropHeight = Math.max(1, Math.round((cropArea.height * height) / 100));
          pipeline = pipeline.extract({
            left,
            top,
            width: Math.min(cropWidth, width - left),
            height: Math.min(cropHeight, height - top),
          });
        }
      }

      processed = await pipeline
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
    } catch (e) {
      console.error("album cover upload sharp:", e);
      return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status: 400 });
    }

    const key = generateR2Key(`cover_${randomUUID()}.jpg`, `album-covers/${albumId}`);
    await uploadToR2(processed, key, "image/jpeg", {
      type: "album_custom_cover",
      albumId: String(albumId),
    });

    const previousKey = standaloneKeyToDelete(album);

    await prisma.album.update({
      where: { id: albumId },
      data: {
        coverPhotoId: null,
        coverThumbnailKey: key,
        coverCropX: null,
        coverCropY: null,
        coverCropZoom: null,
        coverCropAspect: null,
      },
    });

    if (previousKey && previousKey !== key) {
      try {
        await deleteFromR2(previousKey);
      } catch (e) {
        console.warn("No se pudo borrar la portada anterior:", e);
      }
    }

    return NextResponse.json({
      success: true,
      coverThumbnailKey: key,
      coverImageUrl: getR2PublicUrl(key),
      coverPhotoId: null,
    });
  } catch (e: any) {
    console.error("album cover upload POST:", e);
    return NextResponse.json(
      { error: e?.message || "Error al subir la portada" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dashboard/albums/[id]/cover/upload
 * Quita la portada propia (no toca las fotos del álbum).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const albumId = parseInt(id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const album = await loadOwnedAlbum(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const previousKey = standaloneKeyToDelete(album);
    if (!previousKey) {
      return NextResponse.json({ success: true, coverThumbnailKey: null });
    }

    await prisma.album.update({
      where: { id: albumId },
      data: { coverThumbnailKey: null },
    });

    try {
      await deleteFromR2(previousKey);
    } catch (e) {
      console.warn("No se pudo borrar la portada del storage:", e);
    }

    return NextResponse.json({ success: true, coverThumbnailKey: null });
  } catch (e: any) {
    console.error("album cover upload DELETE:", e);
    return NextResponse.json(
      { error: e?.message || "Error al quitar la portada" },
      { status: 500 }
    );
  }
}
