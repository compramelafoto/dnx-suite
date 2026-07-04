import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { buildTiledWatermarkSvg, WATERMARK_TILED_TEXT } from "@/lib/watermarking";
import { fileExistsInR2, readFromR2, uploadToR2, urlToR2Key } from "@/lib/r2-client";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { validateHiddenAlbumPhotoAccess, HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import { Role } from "@prisma/client";

export const runtime = "nodejs";

const PREVIEW_MAX_SIDE = 850;
const BOUGHT_MAX_SIDE = 2000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const WATERMARK_VERSION = "v7"; // Marca de agua reducida 50% (escala y opacidad)
const WATERMARK_SCALE = 0.25 * 1.15 * 1.25 * 0.5; // 50% del valor anterior
const WATERMARK_PNG_OPACITY = 0.2109375; // 50% de la opacidad anterior del logo PNG

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "0.0.0.0";
  return req.headers.get("x-real-ip") || "0.0.0.0";
}

function maskIp(ip: string) {
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return `${parts.slice(0, 3).join(":")}:xxxx`;
  }
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return "x.x.x.x";
}

function getPreviewKey(previewUrl?: string | null, originalKey?: string | null) {
  if (previewUrl) {
    try {
      return urlToR2Key(previewUrl);
    } catch {}
  }
  if (originalKey) {
    try {
      const originalKeyNormalized = urlToR2Key(originalKey);
      return originalKeyNormalized.replace(/original_/, "preview_");
    } catch {
      const previewCandidate = originalKey.replace(/original_/, "preview_");
      try {
        return urlToR2Key(previewCandidate);
      } catch {}
      if (previewCandidate.startsWith("http://") || previewCandidate.startsWith("https://")) {
        return null;
      }
      return previewCandidate;
    }
  }
  return null;
}

async function loadWatermarkPng(): Promise<Buffer | null> {
  try {
    const watermarkPath = path.join(process.cwd(), "public", "watermark.png");
    return await fs.readFile(watermarkPath);
  } catch {
    return null;
  }
}

async function buildWatermarkPngComposites(params: {
  imageWidth: number;
  imageHeight: number;
}) {
  const watermarkBuffer = await loadWatermarkPng();
  if (!watermarkBuffer) return [];

  const watermark = sharp(watermarkBuffer);
  const watermarkMetadata = await watermark.metadata();
  if (!watermarkMetadata.width || !watermarkMetadata.height) return [];

  const cellWidth = Math.floor(params.imageWidth / 3);
  const cellHeight = Math.floor(params.imageHeight / 3);
  const maxWatermarkWidth = Math.max(
    1,
    Math.min(Math.floor(params.imageWidth * WATERMARK_SCALE), cellWidth - 2, params.imageWidth - 2)
  );
  const maxWatermarkHeight = Math.max(
    1,
    Math.min(Math.floor(params.imageHeight * WATERMARK_SCALE), cellHeight - 2, params.imageHeight - 2)
  );

  const watermarkWidth = maxWatermarkWidth;
  const watermarkHeight = Math.floor(
    (watermarkMetadata.height * watermarkWidth) / watermarkMetadata.width
  );
  const resizedWatermark = await watermark
    .resize(watermarkWidth, Math.min(watermarkHeight, maxWatermarkHeight), { fit: "inside" })
    .png()
    .toBuffer();

  const composites: Array<{ input: Buffer; top: number; left: number; blend?: sharp.Blend; opacity?: number }> = [];
  const offsetX = Math.max(0, Math.floor((cellWidth - watermarkWidth) / 2));
  const offsetY = Math.max(0, Math.floor((cellHeight - Math.min(watermarkHeight, maxWatermarkHeight)) / 2));

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      composites.push({
        input: resizedWatermark,
        top: Math.max(0, row * cellHeight + offsetY),
        left: Math.max(0, col * cellWidth + offsetX),
        blend: "over" as sharp.Blend,
        opacity: WATERMARK_PNG_OPACITY,
      });
    }
  }

  return composites;
}

function hashViewerKey(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function buildCacheKey(params: {
  albumId: number | null;
  photoId: number;
  viewerKey: string;
  mode: "preview" | "bought";
  size: number;
}) {
  const bucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const viewerHash = hashViewerKey(params.viewerKey);
  return `watermarks/${WATERMARK_VERSION}/a${params.albumId ?? "x"}/p${params.photoId}/${params.mode}/s${params.size}/v${viewerHash}/b${bucket}.jpg`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const photoId = Number.parseInt(id, 10);
    if (!Number.isFinite(photoId)) {
      return NextResponse.json({ error: "ID de foto inválido" }, { status: 400 });
    }

    const viewerCookie = req.cookies.get("viewer-id")?.value || null;
    const viewerId = viewerCookie || crypto.randomBytes(16).toString("hex");
    const clientIp = getClientIp(req);
    const rateKey = `${clientIp}:${viewerId}`;
    const rate = checkRateLimit({ key: rateKey, limit: 60, windowMs: 60 * 1000 });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Rate limit excedido" }, { status: 429 });
    }

    const albumIdParam = req.nextUrl.searchParams.get("albumId");
    const albumId = albumIdParam ? Number.parseInt(albumIdParam, 10) : null;
    const orderIdParam = req.nextUrl.searchParams.get("orderId");
    const orderId = orderIdParam ? Number.parseInt(orderIdParam, 10) : null;
    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode = modeParam === "bought" ? "bought" : "preview";

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        albumId: true,
        previewUrl: true,
        originalKey: true,
        album: {
          select: {
            id: true,
            userId: true,
            isPublic: true,
            isHidden: true,
            hiddenPhotosEnabled: true,
            enablePrintedPhotos: true,
            enableDigitalPhotos: true,
            selectedLabId: true,
            albumProfitMarginPercent: true,
            pickupBy: true,
            digitalPhotoPriceCents: true,
            termsAcceptedAt: true,
            termsVersion: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    if (albumId && photo.albumId !== albumId) {
      return NextResponse.json({ error: "Foto no pertenece al álbum" }, { status: 403 });
    }

    const authUser = await getAuthUser();
    const hasAccess = authUser?.id && photo.album
      ? await prisma.albumAccess.findUnique({
          where: { albumId_userId: { albumId: photo.album.id, userId: authUser.id } },
        })
      : null;
    const canViewPrivateAlbum =
      authUser &&
      photo.album &&
      (authUser.id === photo.album.userId ||
        Boolean(hasAccess) ||
        authUser.role === Role.ADMIN);

    if (!photo.album || !isAlbumComplete(photo.album)) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }

    if (!isAlbumPubliclyAccessible(photo.album) && !canViewPrivateAlbum) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }

    // Álbum con fotos ocultas: sin acceso privado requiere grant vigente que incluya esta foto
    const albumWithHidden = photo.album as { hiddenPhotosEnabled?: boolean };
    if (albumWithHidden.hiddenPhotosEnabled && !canViewPrivateAlbum) {
      const grantCookie = req.cookies.get(HIDDEN_ALBUM_GRANT_COOKIE)?.value ?? null;
      const allowed = await validateHiddenAlbumPhotoAccess(
        photo.albumId,
        photo.id,
        grantCookie,
        prisma
      );
      if (!allowed) {
        return NextResponse.json({ error: "No tenés permiso para ver esta foto. Completá la verificación por selfie del álbum." }, { status: 403 });
      }
    }

    const paidOrder = orderId
      ? await prisma.order.findFirst({
          where: {
            id: orderId,
            status: "PAID",
            albumId: photo.albumId,
            items: { some: { photoId } },
          },
          select: { id: true, buyerEmail: true },
        })
      : authUser
        ? await prisma.order.findFirst({
            where: {
              status: "PAID",
              albumId: photo.albumId,
              buyerEmail: authUser.email,
              items: { some: { photoId } },
            },
            select: { id: true, buyerEmail: true },
          })
        : null;

    const viewerLabel = authUser
      ? `USER:${authUser.email || authUser.id}`
      : `VISITANTE:${viewerId.slice(0, 6)} IP:${maskIp(clientIp)}`;
    const timestamp = new Date().toISOString();

    const applyBoughtWatermark = mode === "bought" && process.env.WATERMARK_BOUGHT_ENABLED === "true";
    const size = mode === "bought" ? BOUGHT_MAX_SIDE : PREVIEW_MAX_SIDE;
    const cacheKey = buildCacheKey({
      albumId: photo.albumId,
      photoId: photo.id,
      viewerKey: `${viewerLabel}:${paidOrder?.id ?? "nop"}`,
      mode,
      size,
    });

    try {
      const cached = await fileExistsInR2(cacheKey);
      if (cached) {
        const cachedBuffer = await readFromR2(cacheKey);
        const response = new NextResponse(new Uint8Array(cachedBuffer), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "private, no-store, max-age=0",
          },
        });
        if (!viewerCookie) {
          response.cookies.set("viewer-id", viewerId, { httpOnly: true, sameSite: "lax", path: "/" });
        }
        return response;
      }
    } catch (err) {
      console.warn("No se pudo leer cache de watermark, se regenera", err);
    }

    const previewKey = getPreviewKey(photo.previewUrl, photo.originalKey);
    if (!previewKey) {
      return NextResponse.json({ error: "Preview no disponible" }, { status: 404 });
    }

    const originalBuffer = await readFromR2(previewKey);
    const baseImage = sharp(originalBuffer).rotate();
    const resizedBuffer = await baseImage.resize(size, size, { fit: "inside", withoutEnlargement: true }).toBuffer();
    const resized = sharp(resizedBuffer);
    const meta = await resized.metadata();
    const width = meta.width || size;
    const height = meta.height || size;
    const fontSize =
      mode === "bought"
        ? Math.max(20, Math.floor(Math.min(width, height) / 24))
        : Math.max(22, Math.floor(Math.min(width, height) / 18));
    const opacity = 0.5; // 50% menos presencia del texto repetido
    const scaledFontSize = Math.max(12, Math.floor(fontSize * 0.75)); // 50% menos tamaño
    const overlay = buildTiledWatermarkSvg({
      width,
      height,
      text: WATERMARK_TILED_TEXT,
      opacity,
      fontSize: scaledFontSize,
      rotations: [0, -30, 30, -60],
      centerText: "@compramelafoto.com",
      blurStdDev: Math.max(0.1, scaledFontSize * 0.05),
      blurDx: Math.max(0.1, scaledFontSize * 0.05),
      blurDy: 0,
    });

    const pngComposites = await buildWatermarkPngComposites({ imageWidth: width, imageHeight: height });
    const overlayComposites = [
      ...pngComposites,
      { input: overlay, blend: "over" as sharp.Blend },
    ];

    const outputBuffer = await (mode === "bought" && !applyBoughtWatermark
      ? resized.jpeg({ quality: 90 }).toBuffer()
      : resized
          .composite(overlayComposites)
          .jpeg({ quality: 50 })
          .toBuffer());

    try {
      await uploadToR2(outputBuffer, cacheKey, "image/jpeg", {
        watermark: "dynamic",
        albumId: String(photo.albumId),
        photoId: String(photo.id),
      });
    } catch (err) {
      console.warn("No se pudo cachear watermark en R2", err);
    }

    const response = new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
    if (!viewerCookie) {
      response.cookies.set("viewer-id", viewerId, { httpOnly: true, sameSite: "lax", path: "/" });
    }
    return response;
  } catch (error) {
    console.error("GET /api/photos/[id]/view error:", error);
    return NextResponse.json({ error: "Error generando preview" }, { status: 500 });
  }
}
