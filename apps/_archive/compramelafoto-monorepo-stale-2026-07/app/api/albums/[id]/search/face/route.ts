import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchFacesByImage } from "@/lib/faces/rekognition";
import { Role } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

async function ensureAlbumAccess(albumId: number) {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, userId: true, isPublic: true, isHidden: true },
  });
  if (!album) return { ok: false, album: null };

  const authUser = await getAuthUser();
  if (!isAlbumPubliclyAccessible(album)) {
    const isOwner = authUser?.id === album.userId;
    const isAdmin = authUser?.role === Role.ADMIN;
    const hasAccess = authUser
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId, userId: authUser.id } },
        })
      : null;
    if (!isOwner && !hasAccess && !isAdmin) {
      return { ok: false, album };
    }
  }
  return { ok: true, album };
}

async function getImageBytes(req: NextRequest): Promise<Buffer> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file && file instanceof File) {
      const buffer = Buffer.from(await file.arrayBuffer());
      return buffer;
    }
  } else if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const imageUrl = (body?.imageUrl || "").toString().trim();
    if (imageUrl) {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        throw new Error("No se pudo descargar la imagen");
      }
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }
  throw new Error("Se requiere file (multipart) o imageUrl");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await Promise.resolve(params);
  const albumId = Number(resolved.id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit({ key: `search-face:${albumId}:${ip}`, limit: 10, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const access = await ensureAlbumAccess(albumId);
  if (!access.ok) {
    return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
  }

  try {
    const imageBytes = await getImageBytes(req);
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
            originalKey: true,
            analysisStatus: true,
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
      if (!d.photo || d.photo.albumId !== albumId) return;
      const score = similarityByFace.get(d.rekognitionFaceId) ?? 0;
      const current = photoScore.get(d.photo.id) ?? 0;
      if (score > current) {
        photoScore.set(d.photo.id, score);
        photoData.set(d.photo.id, d.photo);
      }
    });

    const items = Array.from(photoData.entries())
      .map(([id, photo]) => ({
        ...photo,
        // Usar el endpoint de preview con marca de agua dinámica en lugar de previewUrl directo
        // Siempre usar mode=preview para asegurar marca de agua
        previewUrl: `/api/photos/${photo.id}/view?mode=preview&albumId=${albumId}`,
        similarity: photoScore.get(id) ?? 0,
      }))
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error buscando rostro", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
