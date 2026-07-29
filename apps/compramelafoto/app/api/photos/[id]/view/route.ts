import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  applyClassicPreviewWatermark,
  getDynamicWatermarkCacheVersion,
  renderPublicWatermarkedJpeg,
} from "@/lib/images/watermark-render";
import { loadCenterWatermarkTextForPhoto } from "@/lib/images/watermark-photographer-center";
import {
  getPublicPhotoVariantConfig,
  isServePregeneratedVariantsEnabled,
} from "@/lib/images/photo-variant-config";
import { tryServePregeneratedVariant } from "@/lib/images/resolve-photo-variant";
import { loadVariantGenerationSourceBuffer } from "@/lib/images/photo-variant-source";
import { fileExistsInR2, readFromR2, uploadToR2, urlToR2Key } from "@/lib/r2-client";
import { isAlbumPubliclyAccessible, isAlbumUnlistedWithDirectLink } from "@/lib/album-helpers";
import { validateHiddenAlbumPhotoAccess, HIDDEN_ALBUM_GRANT_COOKIE } from "@/lib/hidden-album-audit";
import { denyIfTestAlbumNotOwnerPreview } from "@/lib/public-album-test-access";
import { Role } from "@/lib/prisma";

export const runtime = "nodejs";

const BOUGHT_MAX_SIDE = 2000;
/** Portada: JPEG desde original en R2, sin marcas dinámicas ni preview almacenado */
const COVER_MAX_SIDE = 720;
const CACHE_TTL_MS = 60 * 60 * 1000;

type CoverSourceUsed = "original" | "preview" | "placeholder";

function logCoverServe(payload: {
  photoId: number;
  albumId: number;
  hasOriginalKey: boolean;
  hasPreviewUrl: boolean;
  sourceUsed: CoverSourceUsed;
  errorMessage?: string;
}) {
  console.info("[photo-view] cover", JSON.stringify(payload));
}

type ThumbSourceUsed = "pregenerated" | "dynamic-preview" | "legacy-preview" | "none";

/** Log temporal de diagnóstico para grilla pública (mode=thumb). */
function logThumbServe(payload: {
  photoId: number;
  albumId: number | null;
  mode: "thumb";
  hasThumbWatermarkedKey: boolean;
  hasPreviewWatermarkedKey: boolean;
  variantsStatus: string | null;
  servePregeneratedEnabled: boolean;
  sourceUsed: ThumbSourceUsed;
}) {
  console.info("[photo-view] thumb", JSON.stringify(payload));
}

async function resolveEffectiveCoverPhotoId(
  albumId: number,
  coverPhotoId: number | null | undefined
): Promise<number | null> {
  if (coverPhotoId != null) {
    const designated = await prisma.photo.findFirst({
      where: { id: coverPhotoId, albumId, isRemoved: false },
      select: { id: true },
    });
    if (designated) return designated.id;
  }
  const first = await prisma.photo.findFirst({
    where: { albumId, isRemoved: false },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

function resolveCoverPreviewR2Key(
  previewUrl?: string | null,
  originalKey?: string | null
): string | null {
  return getPublicPreviewKeyFromUrl(previewUrl) ?? getPreviewKey(previewUrl, originalKey);
}

async function loadCoverSourceBuffer(photo: {
  originalKey?: string | null;
  previewUrl?: string | null;
}): Promise<{ buffer: Buffer; sourceUsed: CoverSourceUsed; errorMessage?: string }> {
  const errors: string[] = [];

  if (photo.originalKey?.trim()) {
    try {
      const originalR2Key = urlToR2Key(photo.originalKey);
      const buffer = await readFromR2(originalR2Key);
      return { buffer, sourceUsed: "original" };
    } catch (err) {
      errors.push(`original: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const previewKey = resolveCoverPreviewR2Key(photo.previewUrl, photo.originalKey);
  if (previewKey) {
    try {
      const buffer = await readFromR2(previewKey);
      return { buffer, sourceUsed: "preview" };
    } catch (err) {
      errors.push(`preview: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const placeholder = await sharp({
    create: {
      width: 720,
      height: 720,
      channels: 3,
      background: { r: 243, g: 244, b: 246 },
    },
  })
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  return {
    buffer: placeholder,
    sourceUsed: "placeholder",
    errorMessage: errors.length ? errors.join("; ") : "no_original_or_preview",
  };
}

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

/** Solo previewUrl — usado en thumb/preview públicos (sin inferir desde originalKey). */
function getPublicPreviewKeyFromUrl(previewUrl?: string | null): string | null {
  const raw = previewUrl?.trim();
  if (!raw) return null;
  try {
    return urlToR2Key(raw);
  } catch {
    return null;
  }
}

/** previewUrl + fallback original→preview — solo mode=bought (legacy). */
function getPreviewKey(previewUrl?: string | null, originalKey?: string | null) {
  const fromUrl = getPublicPreviewKeyFromUrl(previewUrl);
  if (fromUrl) return fromUrl;
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

function hashViewerKey(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function buildCacheKey(params: {
  albumId: number | null;
  photoId: number;
  viewerKey: string;
  mode: "thumb" | "preview" | "bought" | "cover";
  size: number;
}) {
  const bucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const viewerHash =
    params.mode === "cover" ? "cover" : hashViewerKey(params.viewerKey);
  return `watermarks/${getDynamicWatermarkCacheVersion()}/a${params.albumId ?? "x"}/p${params.photoId}/${params.mode}/s${params.size}/v${viewerHash}/b${bucket}.jpg`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const mode: "thumb" | "preview" | "bought" | "cover" =
      modeParam === "bought"
        ? "bought"
        : modeParam === "cover"
          ? "cover"
          : modeParam === "thumb"
            ? "thumb"
            : "preview";

    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
      select: {
        id: true,
        albumId: true,
        isRemoved: true,
        previewUrl: true,
        originalKey: true,
        thumbWatermarkedKey: true,
        previewWatermarkedKey: true,
        variantsStatus: true,
        album: {
          select: {
            id: true,
            userId: true,
            isTest: true,
            eventId: true,
            coverPhotoId: true,
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
            mode: true,
            schoolId: true,
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
    }

    const authUser = await getAuthUser();
    const isRemoved = Boolean((photo as { isRemoved?: boolean }).isRemoved);
    const isAlbumOwnerOrAdmin =
      authUser &&
      photo.album &&
      (authUser.id === photo.album.userId || authUser.role === Role.ADMIN);

    if (isRemoved && !isAlbumOwnerOrAdmin && (mode === "thumb" || mode === "preview" || mode === "cover")) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }

    if (albumId && photo.albumId !== albumId) {
      return NextResponse.json({ error: "Foto no pertenece al álbum" }, { status: 403 });
    }

    if (photo.album) {
      const testDeny = await denyIfTestAlbumNotOwnerPreview(
        { isTest: photo.album.isTest, userId: photo.album.userId },
        authUser
      );
      if (testDeny) return testDeny;
    }
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

    if (!photo.album) {
      return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
    }

    if (
      !isAlbumPubliclyAccessible(photo.album) &&
      !isAlbumUnlistedWithDirectLink(photo.album) &&
      !canViewPrivateAlbum
    ) {
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

    if (mode === "thumb" || mode === "preview") {
      const pregenerated = await tryServePregeneratedVariant({ photo, mode });
      if (pregenerated) {
        if (mode === "thumb") {
          logThumbServe({
            photoId: photo.id,
            albumId: photo.albumId,
            mode: "thumb",
            hasThumbWatermarkedKey: Boolean(photo.thumbWatermarkedKey?.trim()),
            hasPreviewWatermarkedKey: Boolean(photo.previewWatermarkedKey?.trim()),
            variantsStatus: photo.variantsStatus ?? null,
            servePregeneratedEnabled: isServePregeneratedVariantsEnabled(),
            sourceUsed: "pregenerated",
          });
        }
        if (!viewerCookie) {
          pregenerated.cookies.set("viewer-id", viewerId, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
        }
        return pregenerated;
      }
    }

    if (mode === "cover") {
      const effectiveCoverPhotoId = await resolveEffectiveCoverPhotoId(
        photo.albumId,
        photo.album.coverPhotoId
      );
      if (effectiveCoverPhotoId !== photo.id) {
        logCoverServe({
          photoId: photo.id,
          albumId: photo.albumId,
          hasOriginalKey: Boolean(photo.originalKey?.trim()),
          hasPreviewUrl: Boolean(photo.previewUrl?.trim()),
          sourceUsed: "placeholder",
          errorMessage: "not_effective_cover_photo",
        });
        return NextResponse.json(
          { error: "Solo la portada efectiva del álbum puede verse por este modo." },
          { status: 403 }
        );
      }

      const coverCacheKey = buildCacheKey({
        albumId: photo.albumId,
        photoId: photo.id,
        viewerKey: "cover",
        mode: "cover",
        size: COVER_MAX_SIDE,
      });
      try {
        const cached = await fileExistsInR2(coverCacheKey);
        if (cached) {
          const cachedBuffer = await readFromR2(coverCacheKey);
          logCoverServe({
            photoId: photo.id,
            albumId: photo.albumId,
            hasOriginalKey: Boolean(photo.originalKey?.trim()),
            hasPreviewUrl: Boolean(photo.previewUrl?.trim()),
            sourceUsed: "original",
            errorMessage: "r2_cache_hit",
          });
          return new NextResponse(new Uint8Array(cachedBuffer), {
            headers: {
              "Content-Type": "image/jpeg",
              "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
              "X-Photo-Cover-Source": "cache",
            },
          });
        }
      } catch (err) {
        console.warn("No se pudo leer cache portada, se regenera", err);
      }

      const { buffer: sourceBuffer, sourceUsed, errorMessage } = await loadCoverSourceBuffer(photo);
      const outputBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(COVER_MAX_SIDE, COVER_MAX_SIDE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();

      logCoverServe({
        photoId: photo.id,
        albumId: photo.albumId,
        hasOriginalKey: Boolean(photo.originalKey?.trim()),
        hasPreviewUrl: Boolean(photo.previewUrl?.trim()),
        sourceUsed,
        errorMessage,
      });

      if (sourceUsed !== "placeholder") {
        try {
          await uploadToR2(outputBuffer, coverCacheKey, "image/jpeg", {
            type: "album_cover_view",
            albumId: String(photo.albumId),
            photoId: String(photo.id),
            coverSource: sourceUsed,
          });
        } catch (err) {
          console.warn("No se pudo cachear portada en R2", err);
        }
      }

      return new NextResponse(new Uint8Array(outputBuffer), {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control":
            sourceUsed === "placeholder"
              ? "public, max-age=300"
              : "public, max-age=86400, stale-while-revalidate=604800",
          "X-Photo-Cover-Source": sourceUsed,
        },
      });
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

    const variantConfig = getPublicPhotoVariantConfig();
    const applyBoughtWatermark = mode === "bought" && process.env.WATERMARK_BOUGHT_ENABLED === "true";
    const size =
      mode === "bought"
        ? BOUGHT_MAX_SIDE
        : mode === "thumb"
          ? variantConfig.thumbMaxSide
          : variantConfig.previewMaxSide;
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
        if (mode === "thumb") {
          logThumbServe({
            photoId: photo.id,
            albumId: photo.albumId,
            mode: "thumb",
            hasThumbWatermarkedKey: Boolean(photo.thumbWatermarkedKey?.trim()),
            hasPreviewWatermarkedKey: Boolean(photo.previewWatermarkedKey?.trim()),
            variantsStatus: photo.variantsStatus ?? null,
            servePregeneratedEnabled: isServePregeneratedVariantsEnabled(),
            sourceUsed: "dynamic-preview",
          });
        }
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

    const previewKey =
      mode === "thumb" || mode === "preview"
        ? getPublicPreviewKeyFromUrl(photo.previewUrl)
        : getPreviewKey(photo.previewUrl, photo.originalKey);
    let sourceBuffer: Buffer;
    if (mode === "thumb" || mode === "preview") {
      try {
        const { buffer } = await loadVariantGenerationSourceBuffer({
          photoId: photo.id,
          albumId: photo.albumId,
          previewUrl: photo.previewUrl,
          originalKey: photo.originalKey,
        });
        sourceBuffer = buffer;
      } catch (err) {
        console.warn("[photo-view] variant_source_fallback", {
          photoId: photo.id,
          albumId: photo.albumId,
          err: err instanceof Error ? err.message : String(err),
        });
        if (!previewKey) {
          if (mode === "thumb") {
            logThumbServe({
              photoId: photo.id,
              albumId: photo.albumId,
              mode: "thumb",
              hasThumbWatermarkedKey: Boolean(photo.thumbWatermarkedKey?.trim()),
              hasPreviewWatermarkedKey: Boolean(photo.previewWatermarkedKey?.trim()),
              variantsStatus: photo.variantsStatus ?? null,
              servePregeneratedEnabled: isServePregeneratedVariantsEnabled(),
              sourceUsed: "none",
            });
          }
          return NextResponse.json({ error: "Preview no disponible" }, { status: 404 });
        }
        try {
          sourceBuffer = await readFromR2(previewKey);
        } catch {
          return NextResponse.json({ error: "Preview no disponible" }, { status: 404 });
        }
      }
    } else {
      if (!previewKey) {
        return NextResponse.json({ error: "Preview no disponible" }, { status: 404 });
      }
      try {
        sourceBuffer = await readFromR2(previewKey);
      } catch {
        return NextResponse.json({ error: "Preview no disponible" }, { status: 404 });
      }
    }

    let outputBuffer: Buffer;
    if (mode === "thumb" || mode === "preview") {
      const centerText = await loadCenterWatermarkTextForPhoto(prisma, {
        photoId: photo.id,
        albumId: photo.albumId,
      });
      outputBuffer = await renderPublicWatermarkedJpeg(
        sourceBuffer,
        mode,
        variantConfig,
        centerText ? { centerText } : undefined
      );
    } else {
      const resizedBuffer = await sharp(sourceBuffer)
        .rotate()
        .resize(size, size, { fit: "inside", withoutEnlargement: true })
        .toBuffer();
      const resized = sharp(resizedBuffer);
      const meta = await resized.metadata();
      const width = meta.width || size;
      const height = meta.height || size;
      outputBuffer = await applyClassicPreviewWatermark(resized, {
        width,
        height,
        mode: "bought",
        applyBoughtWatermark,
      });
    }

    try {
      await uploadToR2(outputBuffer, cacheKey, "image/jpeg", {
        watermark: "dynamic",
        albumId: String(photo.albumId),
        photoId: String(photo.id),
      });
    } catch (err) {
      console.warn("No se pudo cachear watermark en R2", err);
    }

    if (mode === "thumb") {
      logThumbServe({
        photoId: photo.id,
        albumId: photo.albumId,
        mode: "thumb",
        hasThumbWatermarkedKey: Boolean(photo.thumbWatermarkedKey?.trim()),
        hasPreviewWatermarkedKey: Boolean(photo.previewWatermarkedKey?.trim()),
        variantsStatus: photo.variantsStatus ?? null,
        servePregeneratedEnabled: isServePregeneratedVariantsEnabled(),
        sourceUsed: "dynamic-preview",
      });
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
