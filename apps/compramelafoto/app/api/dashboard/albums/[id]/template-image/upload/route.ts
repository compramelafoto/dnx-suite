import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/dashboard/albums/[id]/template-image/upload
 * Sube la imagen (PNG) de una plantilla. FormData: file.
 * Devuelve { imageUrl } para usar al crear la plantilla.
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

    const albumId = parseInt((await params).id, 10);
    if (!Number.isInteger(albumId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await prisma.album.findFirst({
      where: { id: albumId, userId: user.id },
      select: { id: true },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.arrayBuffer) {
      return NextResponse.json({ error: "Falta el archivo (file)" }, { status: 400 });
    }

    const contentType = (file.type || "image/png").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá PNG, JPG o WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 10 MB." },
        { status: 400 }
      );
    }

    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const name = `plantilla_${randomUUID()}.${ext}`;
    const key = generateR2Key(name, `template-images/${albumId}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(buffer, key, contentType);
    const imageUrl = getR2PublicUrl(key);

    return NextResponse.json({ imageUrl });
  } catch (e) {
    console.error("template-image upload error:", e);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
