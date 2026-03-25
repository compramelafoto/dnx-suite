import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { Role } from "@prisma/client";

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolved = await Promise.resolve(params);
  const albumId = Number(resolved.id);
  if (!Number.isFinite(albumId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rate = checkRateLimit({ key: `search-text:${albumId}:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rate.allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const access = await ensureAlbumAccess(albumId);
  if (!access.ok) {
    return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
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
        albumId,
        isRemoved: false,
        analysisStatus: "DONE",
        ocrTokens: { some: { textNorm: { contains: qNorm } } },
      },
      select: {
        id: true,
        previewUrl: true,
        originalKey: true,
        analysisStatus: true,
      },
      orderBy: { createdAt: "asc" },
      skip,
      take: limit,
    }),
    prisma.photo.count({
      where: {
        albumId,
        isRemoved: false,
        analysisStatus: "DONE",
        ocrTokens: { some: { textNorm: { contains: qNorm } } },
      },
    }),
  ]);

  // Usar el endpoint de preview con marca de agua dinámica en lugar de previewUrl directo
  // Siempre usar mode=preview para asegurar marca de agua
  const itemsWithWatermark = items.map((item) => ({
    ...item,
    previewUrl: `/api/photos/${item.id}/view?mode=preview&albumId=${albumId}`,
  }));

  return NextResponse.json({
    items: itemsWithWatermark,
    total,
    page,
    limit,
  });
}
