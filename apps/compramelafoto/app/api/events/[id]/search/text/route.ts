import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePublicPhotoPreviewSrc } from "@/lib/images/public-photo-view-url";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[\s-]+/g, "");
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await Promise.resolve(params);
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit({ key: `event-search-text:${eventId}:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Evento no disponible" }, { status: 404 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const photographerIdParam = url.searchParams.get("photographerId");
  const photographerId = photographerIdParam ? Number(photographerIdParam) : null;
  const photographerFilter =
    photographerId && Number.isFinite(photographerId)
      ? { uploadedBy: { id: photographerId } }
      : {};
  if (!q) {
    return NextResponse.json({ error: "q requerido" }, { status: 400 });
  }
  const qNorm = normalizeText(q);
  if (qNorm.length < 2) {
    return NextResponse.json({ error: "q demasiado corto" }, { status: 400 });
  }

  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 30)));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.photo.findMany({
      where: {
        album: {
          eventId,
          isHidden: false,
          deletedAt: null,
        },
        isRemoved: false,
        analysisStatus: "DONE",
        ocrTokens: { some: { textNorm: { contains: qNorm } } },
        ...photographerFilter,
      },
      select: {
        id: true,
        previewUrl: true,
        albumId: true,
        album: {
          select: {
            isPublic: true,
            isHidden: true,
            enablePrintedPhotos: true,
            enableDigitalPhotos: true,
            selectedLabId: true,
            albumProfitMarginPercent: true,
            pickupBy: true,
            digitalPhotoPriceCents: true,
            termsAcceptedAt: true,
            termsVersion: true,
          },
        },
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.photo.count({
      where: {
        album: {
          eventId,
          isHidden: false,
          deletedAt: null,
        },
        isRemoved: false,
        analysisStatus: "DONE",
        ocrTokens: { some: { textNorm: { contains: qNorm } } },
        ...photographerFilter,
      },
    }),
  ]);

  const itemsWithWatermark = items
    .filter((item) => item.album && isAlbumPubliclyAccessible(item.album))
    .map((item) => ({
      id: item.id,
      previewUrl: resolvePublicPhotoPreviewSrc({
        photoId: item.id,
        albumId: item.albumId,
        storedPreviewUrl: item.previewUrl,
        mode: "thumb",
      }),
      albumId: item.albumId,
      photographerName: item.uploadedBy?.name ?? null,
    }))
    .filter((item) => Boolean(item.previewUrl));

  return NextResponse.json({
    items: itemsWithWatermark,
    total: itemsWithWatermark.length,
    page,
    limit,
  });
}
