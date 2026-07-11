import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getClfReadonlyClient } from "@/lib/clf-readonly-db";
import { readR2ObjectBuffer, resolveClfPhotoSourceKey } from "@/lib/r2-read";

type Ctx = { params: Promise<{ photoId: string }> };

/**
 * Sirve thumbnail editorial temporal para el selector (auth requerida).
 * No expone originalKey ni URL CLF al cliente.
 */
export async function GET(request: Request, context: Ctx) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { photoId: raw } = await context.params;
  const photoId = Number(raw);
  const albumId = Number(new URL(request.url).searchParams.get("albumId"));
  if (!Number.isFinite(photoId) || !Number.isFinite(albumId)) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const existing = await prisma.infoSpotEditorialAsset.findFirst({
    where: { sourceType: "CLF_PHOTO", sourcePhotoId: photoId },
    select: { thumbnailUrl: true, url: true },
  });
  if (existing?.thumbnailUrl || existing?.url) {
    return NextResponse.redirect(existing.thumbnailUrl || existing.url);
  }

  const clf = getClfReadonlyClient();
  const photo = await clf.photo.findFirst({
    where: {
      id: photoId,
      albumId,
      isRemoved: false,
      storageDeletedAt: null,
    },
    select: {
      originalKey: true,
      previewUrl: true,
      previewWatermarkedKey: true,
      thumbWatermarkedKey: true,
    },
  });
  if (!photo) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  try {
    const key = resolveClfPhotoSourceKey(photo);
    const buffer = await readR2ObjectBuffer(key);
    const thumb = await sharp(buffer)
      .rotate()
      .resize({ width: 320, height: 320, fit: "cover" })
      .jpeg({ quality: 70 })
      .toBuffer();
    return new NextResponse(new Uint8Array(thumb), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar thumb";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
