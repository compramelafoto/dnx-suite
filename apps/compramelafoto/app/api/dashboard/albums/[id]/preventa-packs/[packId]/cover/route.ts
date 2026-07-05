import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";
import { findAlbumOwnedByUser } from "@/lib/preventa-canjeable/dashboard-pack-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 800;

/**
 * POST /api/dashboard/albums/[id]/preventa-packs/[packId]/cover
 * Sube imagen del pack, la recorta al centro a 1:1 (800×800), guarda en R2 y actualiza PackDefinition.coverImageUrl.
 * FormData: file (imagen).
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: { params: { id: string; packId: string } | Promise<{ id: string; packId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const p = await params;
    const albumId = parseInt(p.id, 10);
    const packId = parseInt(p.packId, 10);
    if (!Number.isInteger(albumId) || !Number.isInteger(packId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumOwnedByUser(albumId, user.id);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const pack = await prisma.packDefinition.findFirst({
      where: { id: packId, albumId },
      select: { id: true },
    });
    if (!pack) {
      return NextResponse.json({ error: "Pack no encontrado" }, { status: 404 });
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
      return NextResponse.json({ error: "La imagen no puede superar 5 MB." }, { status: 400 });
    }

    const raw = Buffer.from(await file.arrayBuffer());
    let processed: Buffer;
    try {
      processed = await sharp(raw)
        .rotate()
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover", position: "centre" })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
    } catch (e) {
      console.error("preventa-pack cover sharp:", e);
      return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status: 400 });
    }

    const name = `pack_${packId}_${randomUUID()}.jpg`;
    const key = generateR2Key(name, `preventa-pack-covers/${albumId}`);

    await uploadToR2(processed, key, "image/jpeg");
    const coverImageUrl = getR2PublicUrl(key);

    await prisma.packDefinition.update({
      where: { id: packId },
      data: { coverImageUrl },
    });

    return NextResponse.json({ coverImageUrl });
  } catch (e) {
    console.error("preventa-pack cover POST:", e);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
