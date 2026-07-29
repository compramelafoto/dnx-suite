import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { Role } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { uploadToR2, generateR2Key, getR2PublicUrl } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams =
  | Promise<{ id: string; packId: string }>;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;
const OUTPUT_SIZE = 800;

async function findAlbumForUser(albumId: number, userId: number, role: Role) {
  return prisma.album.findFirst({
    where: role === Role.ADMIN ? { id: albumId } : { id: albumId, userId },
    select: { id: true },
  });
}

/**
 * POST /api/dashboard/albums/[id]/packs/[packId]/cover
 * Sube imagen del pack, la recorta al centro a 1:1 (800×800), guarda en R2 y actualiza AlbumPack.coverImageUrl.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  try {
    const { error, user } = await requireAuth([
      Role.PHOTOGRAPHER,
      Role.LAB_PHOTOGRAPHER,
      Role.ADMIN,
    ]);
    if (error || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const p = await params;
    const albumId = Number.parseInt(String(p.id ?? "").trim(), 10);
    const packId = String(p.packId ?? "").trim();
    if (!Number.isInteger(albumId) || !packId) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const album = await findAlbumForUser(albumId, user.id, user.role);
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const pack = await prisma.albumPack.findFirst({
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
      console.error("album-pack cover sharp:", e);
      return NextResponse.json({ error: "No se pudo procesar la imagen." }, { status: 400 });
    }

    const name = `album_pack_${packId}_${randomUUID()}.jpg`;
    const key = generateR2Key(name, `album-pack-covers/${albumId}`);

    await uploadToR2(processed, key, "image/jpeg");
    const coverImageUrl = getR2PublicUrl(key);

    await prisma.albumPack.update({
      where: { id: packId },
      data: { coverImageUrl },
    });

    return NextResponse.json({ coverImageUrl });
  } catch (e) {
    console.error("album-pack cover POST:", e);
    return NextResponse.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
