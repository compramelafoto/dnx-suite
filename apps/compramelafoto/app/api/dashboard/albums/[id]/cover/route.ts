import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import { readFromR2, uploadToR2, generateR2Key, urlToR2Key } from "@/lib/r2-client";

/**
 * PATCH /api/dashboard/albums/[id]/cover
 * Establece una foto como portada del álbum
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();

    if (!user || user.role !== Role.PHOTOGRAPHER) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id);

    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { photoId, crop, zoom, aspect, cropArea } = body;

    if (photoId === undefined || photoId === null) {
      return NextResponse.json({ error: "photoId es requerido" }, { status: 400 });
    }

    // Verificar que el álbum pertenece al fotógrafo
    const album = await prisma.album.findFirst({
      where: {
        id: albumId,
        userId: user.id,
      },
    });

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    // Si photoId es null, se limpia la portada
    if (photoId === null) {
      try {
        await prisma.album.update({
          where: { id: albumId },
          data: {
            coverPhotoId: null,
            coverThumbnailKey: null,
            coverCropX: null,
            coverCropY: null,
            coverCropZoom: null,
            coverCropAspect: null,
          } as any,
        });
      } catch (updateErr: any) {
        const msg = String(updateErr?.message ?? "");
        if (msg.includes("Unknown argument") || msg.includes("does not exist")) {
          await prisma.album.update({
            where: { id: albumId },
            data: { coverPhotoId: null },
          });
        } else {
          throw updateErr;
        }
      }
      return NextResponse.json({ success: true, coverPhotoId: null });
    }

    const photoIdNum = parseInt(photoId);

    if (isNaN(photoIdNum)) {
      return NextResponse.json({ error: "ID de foto inválido" }, { status: 400 });
    }

    // Verificar que la foto pertenece al álbum
    const photo = await prisma.photo.findFirst({
      where: {
        id: photoIdNum,
        albumId: albumId,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    let coverThumbnailKey: string | null = null;

    if (cropArea && typeof cropArea === "object") {
      const originalKeyRaw = String(photo.originalKey || "");
      const r2Key = originalKeyRaw.startsWith("http://") || originalKeyRaw.startsWith("https://")
        ? urlToR2Key(originalKeyRaw)
        : originalKeyRaw.startsWith("/uploads/")
          ? originalKeyRaw.replace(/^\//, "")
          : originalKeyRaw;

      const originalBuffer = await readFromR2(r2Key);
      const image = sharp(originalBuffer).rotate();
      const meta = await image.metadata();
      const width = meta.width || 0;
      const height = meta.height || 0;
      if (width > 0 && height > 0) {
        const cropLeft = Math.max(0, Math.round((Number(cropArea.x) || 0) * width / 100));
        const cropTop = Math.max(0, Math.round((Number(cropArea.y) || 0) * height / 100));
        const cropWidth = Math.max(1, Math.round((Number(cropArea.width) || 0) * width / 100));
        const cropHeight = Math.max(1, Math.round((Number(cropArea.height) || 0) * height / 100));
        const safeWidth = Math.min(cropWidth, width - cropLeft);
        const safeHeight = Math.min(cropHeight, height - cropTop);

        const thumbBuffer = await sharp(originalBuffer)
          .rotate()
          .extract({ left: cropLeft, top: cropTop, width: safeWidth, height: safeHeight })
          .resize(600, 600, { fit: "cover" })
          .jpeg({ quality: 85, mozjpeg: true })
          .toBuffer();

        const thumbKey = generateR2Key(`cover_${photoIdNum}.jpg`, `album-covers/${albumId}`);
        await uploadToR2(thumbBuffer, thumbKey, "image/jpeg", {
          type: "cover_thumbnail",
          albumId: String(albumId),
          photoId: String(photoIdNum),
        });
        coverThumbnailKey = thumbKey;
      }
    }

    const updateData: Record<string, unknown> = {
      coverPhotoId: photoIdNum,
      coverCropX: typeof crop?.x === "number" ? crop.x : null,
      coverCropY: typeof crop?.y === "number" ? crop.y : null,
      coverCropZoom: typeof zoom === "number" ? zoom : null,
      coverCropAspect: typeof aspect === "number" ? aspect : null,
    };
    if (coverThumbnailKey) {
      updateData.coverThumbnailKey = coverThumbnailKey;
    }

    let updatedAlbum: any;
    try {
      updatedAlbum = await prisma.album.update({
        where: { id: albumId },
        data: updateData as any,
        include: {
          coverPhoto: true,
        },
      });
    } catch (updateErr: any) {
      const msg = String(updateErr?.message ?? "");
      if (msg.includes("Unknown argument") || msg.includes("does not exist")) {
        updatedAlbum = await prisma.album.update({
          where: { id: albumId },
          data: { coverPhotoId: photoIdNum },
          include: { coverPhoto: true },
        });
      } else {
        throw updateErr;
      }
    }

    return NextResponse.json({
      success: true,
      coverPhotoId: updatedAlbum.coverPhotoId,
      coverPhoto: updatedAlbum.coverPhoto,
      coverThumbnailKey: updatedAlbum.coverThumbnailKey || coverThumbnailKey || null,
    });
  } catch (error: any) {
    console.error("Error estableciendo portada:", error);
    return NextResponse.json(
      { error: error?.message || "Error estableciendo portada" },
      { status: 500 }
    );
  }
}
