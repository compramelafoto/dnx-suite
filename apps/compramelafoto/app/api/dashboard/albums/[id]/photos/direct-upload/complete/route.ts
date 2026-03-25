import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ensureAlbumUploadAccess, ensureMpConnected } from "../../upload-helpers";
import { deleteFromR2, getR2ObjectMetadata, readFromR2 } from "@/lib/r2-client";
import { processPhoto } from "@/lib/image-processing";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Procesar imagen (marca de agua, etc.) puede tardar; evitar timeout en serverless
export const maxDuration = 60;

const MAX_BYTES = process.env.MAX_FILE_SIZE
  ? parseInt(process.env.MAX_FILE_SIZE)
  : 10 * 1024 * 1024;
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER]);
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
    const albumId = parseInt(id);
    if (isNaN(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const access = await ensureAlbumUploadAccess(albumId, user.id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await req.json().catch(() => null);
    const key = String(body?.key || "");
    const originalName = String(body?.originalName || "archivo");

    if (!key || !key.startsWith(`albums/${albumId}/raw/`)) {
      return NextResponse.json({ error: "Key inválida" }, { status: 400 });
    }

    const metadata = await getR2ObjectMetadata(key);
    if (metadata.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${MAX_MB}MB.` },
        { status: 400 }
      );
    }

    const buffer = await readFromR2(key);
    const fileKey = `${crypto.randomUUID()}.jpg`;

    const { previewUrl, originalKey } = await processPhoto(
      buffer,
      fileKey,
      false,
      `albums/${albumId}`
    );

    let photo;
    try {
      photo = await prisma.photo.create({
        data: {
          albumId,
          userId: user.id,
          previewUrl,
          originalKey,
          analysisStatus: "PENDING",
        },
      });
    } catch (createErr: any) {
      const errorMsg = String(createErr?.message ?? "");
      if (
        errorMsg.includes("userId") ||
        errorMsg.includes("isRemoved") ||
        errorMsg.includes("analysisStatus") ||
        errorMsg.includes("Unknown argument") ||
        errorMsg.includes("does not exist")
      ) {
        photo = await prisma.photo.create({
          data: { albumId, previewUrl, originalKey },
        });
      } else {
        throw createErr;
      }
    }

    try {
      await prisma.photoAnalysisJob.create({
        data: {
          photoId: photo.id,
          status: "PENDING",
        },
      });
    } catch (jobErr: any) {
      const msg = String(jobErr?.message ?? "");
      if (!msg.includes("PhotoAnalysisJob") && !msg.includes("Unknown argument") && !msg.includes("does not exist")) {
        console.error("Error creando PhotoAnalysisJob:", jobErr);
      }
    }

    try {
      const albumCheck = await prisma.album.findUnique({
        where: { id: albumId },
        select: {
          coverPhotoId: true,
          firstPhotoDate: true,
          expiresAt: true,
        },
      });
      if (albumCheck) {
        const updateData: any = {};
        if (!albumCheck.coverPhotoId) {
          updateData.coverPhotoId = photo.id;
        }
        if (!albumCheck.firstPhotoDate) {
          updateData.firstPhotoDate = new Date();
        }
        if (!albumCheck.expiresAt) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          updateData.expiresAt = expiresAt;
        }
        if (Object.keys(updateData).length > 0) {
          try {
            await prisma.album.update({
              where: { id: albumId },
              data: updateData,
            });
          } catch (updateErr: any) {
            const errorMsg = String(updateErr?.message ?? "");
            if (
              !errorMsg.includes("coverPhotoId") &&
              !errorMsg.includes("firstPhotoDate") &&
              !errorMsg.includes("Unknown argument")
            ) {
              console.error("Error actualizando álbum:", updateErr);
            }
          }
        }
      }
    } catch (albumErr) {
      console.error("Error revisando portada/fechas de álbum:", albumErr);
    }

    try {
      await deleteFromR2(key);
    } catch (deleteErr) {
      console.warn("No se pudo eliminar archivo raw en R2:", deleteErr);
    }

    return NextResponse.json(
      { photo: { id: photo.id, previewUrl, originalKey } },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST direct-upload complete ERROR >>>", err);
    return NextResponse.json(
      { error: "Error procesando foto", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
