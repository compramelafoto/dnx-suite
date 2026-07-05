import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchFacesByImage } from "@/lib/faces/rekognition";
import { resolvePublicPhotoPreviewSrc } from "@/lib/images/public-photo-view-url";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

async function getImageBytes(req: NextRequest): Promise<Buffer> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && file instanceof File) {
      return Buffer.from(await file.arrayBuffer());
    }
  }
  throw new Error("Se requiere file (multipart)");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await Promise.resolve(params);
  const eventId = Number(resolved.id);
  if (!Number.isFinite(eventId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit({ key: `event-search-face:${eventId}:${ip}`, limit: 10, windowMs: 60_000 });
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

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Se requiere file" }, { status: 400 });
    }
    const imageBytes = Buffer.from(await file.arrayBuffer());
    const photographerIdParam = form.get("photographerId");
    const photographerId = photographerIdParam ? Number(photographerIdParam) : null;
    const photographerFilter =
      photographerId && Number.isFinite(photographerId)
        ? { uploadedBy: { id: photographerId } }
        : {};
    const matches = await searchFacesByImage(imageBytes);
    if (matches.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const faceIds = matches.map((m) => m.rekognitionFaceId);
    const detections = await prisma.faceDetection.findMany({
      where: { rekognitionFaceId: { in: faceIds } },
      include: {
        photo: {
          select: {
            id: true,
            albumId: true,
            previewUrl: true,
            analysisStatus: true,
            uploadedBy: { select: { name: true } },
          },
        },
      },
    });

    const similarityByFace = new Map<string, number>();
    matches.forEach((m) => {
      similarityByFace.set(m.rekognitionFaceId, m.similarity ?? 0);
    });

    const photoScore = new Map<number, number>();
    const photoData = new Map<number, any>();
    detections.forEach((d) => {
      if (!d.photo || d.photo.albumId === null) return;
      const score = similarityByFace.get(d.rekognitionFaceId) ?? 0;
      const current = photoScore.get(d.photo.id) ?? 0;
      if (score > current) {
        photoScore.set(d.photo.id, score);
        photoData.set(d.photo.id, d.photo);
      }
    });

    const items = Array.from(photoData.entries())
      .map(([id, photo]) => ({
        id: photo.id,
        previewUrl: resolvePublicPhotoPreviewSrc({
          photoId: photo.id,
          albumId: photo.albumId,
          storedPreviewUrl: photo.previewUrl,
          mode: "thumb",
        }),
        albumId: photo.albumId,
        photographerName: photo.uploadedBy?.name ?? null,
        similarity: photoScore.get(id) ?? 0,
      }))
      .filter((item) => item.albumId && item.previewUrl)
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    const filtered = items.filter((item) => item.albumId);
    const photoIds = filtered.map((item) => item.id);
    if (photoIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const allowed = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
        album: {
          eventId,
          isHidden: false,
          deletedAt: null,
        },
        isRemoved: false,
        ...photographerFilter,
      },
      select: {
        id: true,
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
      },
    });
    const allowedSet = new Set(
      allowed
        .filter((p) => p.album && isAlbumPubliclyAccessible(p.album))
        .map((p) => p.id)
    );

    return NextResponse.json({
      items: filtered.filter((item) => allowedSet.has(item.id)),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error buscando rostro", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
