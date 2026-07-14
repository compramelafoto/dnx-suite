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
import { readR2ObjectBuffer, resolveClfPhotoPreviewSourceKey } from "@/lib/r2-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ photoId: string }> };

async function jpegThumbResponse(buffer: Buffer) {
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
}

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
  if (!Number.isFinite(photoId) || !Number.isFinite(albumId) || photoId <= 0 || albumId <= 0) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  // Variante editorial InfoSpot (derivado ya procesado)
  const editorialPhoto = await prisma.infoSpotEditorialPhoto.findFirst({
    where: { sourcePhotoExternalId: String(photoId) },
    select: {
      editorialMasterKey: true,
      variants: {
        orderBy: { width: "asc" },
        take: 1,
        select: { r2Key: true },
      },
    },
  });
  const variantKey =
    editorialPhoto?.variants[0]?.r2Key || editorialPhoto?.editorialMasterKey || null;
  if (variantKey) {
    try {
      return await jpegThumbResponse(await readR2ObjectBuffer(variantKey));
    } catch {
      // continuar
    }
  }

  // Asset editorial legacy
  const existing = await prisma.infoSpotEditorialAsset.findFirst({
    where: { sourceType: "CLF_PHOTO", sourcePhotoId: photoId },
    select: { thumbnailUrl: true, url: true, r2Key: true },
  });
  if (existing?.r2Key) {
    try {
      return await jpegThumbResponse(await readR2ObjectBuffer(existing.r2Key));
    } catch {
      const candidate = existing.thumbnailUrl || existing.url;
      if (candidate && isSafePublicRedirect(candidate)) {
        return NextResponse.redirect(candidate);
      }
    }
  } else if (existing?.thumbnailUrl || existing?.url) {
    const candidate = existing.thumbnailUrl || existing.url;
    if (candidate && isSafePublicRedirect(candidate)) {
      return NextResponse.redirect(candidate);
    }
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
    const key = resolveClfPhotoPreviewSourceKey(photo);
    return await jpegThumbResponse(await readR2ObjectBuffer(key));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al generar thumb";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function isSafePublicRedirect(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.hostname.includes("r2.cloudflarestorage.com")) return false;
    return true;
  } catch {
    return false;
  }
}
