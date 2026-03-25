import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function getExtension(contentType: string, filename: string): string {
  const ext = filename?.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]?.slice(1);
  if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * POST /api/dashboard/albums/[id]/precompra-products/upload-mockup
 * Subir imagen descriptiva (mockup) del producto. FormData: file (imagen).
 * Se guarda en R2 bajo preventa-mockups/{albumId}/ y se retorna la URL.
 * La imagen se conserva hasta 30 días después del cierre de la pre-venta (limpieza vía cron).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const albumId = parseInt((await Promise.resolve(params)).id, 10);
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

    const contentType = (file.type || "image/jpeg").toLowerCase().split(";")[0].trim();
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Formato no soportado. Usá JPG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }

    const size = file.size;
    if (size > MAX_BYTES) {
      return NextResponse.json(
        { error: "La imagen no puede superar 5 MB." },
        { status: 400 }
      );
    }

    const ext = getExtension(contentType, file.name);
    const name = `mockup_${randomUUID()}.${ext}`;
    const key = generateR2Key(name, `preventa-mockups/${albumId}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(buffer, key, contentType);
    const mockupUrl = getR2PublicUrl(key);

    return NextResponse.json({ mockupUrl });
  } catch (e) {
    console.error("upload-mockup error:", e);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
