import sharp from "sharp";
import { prisma } from "@repo/db";
import { getClfReadonlyClient } from "@/lib/clf-readonly-db";
import { isR2Configured, uploadToR2 } from "@/lib/r2-client";
import { readR2ObjectBuffer, resolveClfPhotoSourceKey } from "@/lib/r2-read";
import { buildClfCopyright, buildClfPhotoCredit } from "@/lib/clf-credit";

export type ImportUsage = "COVER" | "INLINE" | "GALLERY";

const MAX_EDITORIAL_WIDTH = 1800;
const JPEG_QUALITY = 82;

/**
 * Importa (o reutiliza) una foto CLF como asset editorial permanente
 * y la vincula al artículo con usageType.
 *
 * Idempotencia:
 * - Asset global único por (CLF_PHOTO, sourcePhotoId)
 * - Relación única por (articleId, assetId, usageType)
 */
export async function importClfPhotoToArticle(options: {
  articleId: string;
  photoId: number;
  expectedAlbumId: number;
  expectedEventId: number | null;
  usageType: ImportUsage;
  sortOrder?: number;
  captionOverride?: string | null;
  selectedByUserId: number;
  /** Solo DIRECTOR puede forzar crédito si no hay autor. */
  allowMissingPhotographer?: boolean;
}) {
  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: options.articleId },
    select: { id: true, eventId: true, clfAlbumId: true },
  });
  if (!article) throw new Error("Noticia no encontrada");

  if (article.clfAlbumId && article.clfAlbumId !== options.expectedAlbumId) {
    throw new Error("El álbum no coincide con el vinculado a la noticia");
  }
  if (
    options.expectedEventId != null &&
    article.eventId != null &&
    article.eventId !== options.expectedEventId
  ) {
    throw new Error("El evento no coincide con el vinculado a la noticia");
  }

  const clf = getClfReadonlyClient();
  const photo = await clf.photo.findFirst({
    where: {
      id: options.photoId,
      isRemoved: false,
      storageDeletedAt: null,
    },
    select: {
      id: true,
      albumId: true,
      previewUrl: true,
      originalKey: true,
      thumbWatermarkedKey: true,
      previewWatermarkedKey: true,
      userId: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      album: {
        select: {
          id: true,
          eventId: true,
          deletedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!photo) throw new Error("Fotografía no encontrada");
  if (photo.album.deletedAt) throw new Error("El álbum de origen está eliminado");
  if (photo.albumId !== options.expectedAlbumId) {
    throw new Error("La fotografía no pertenece al álbum seleccionado");
  }
  if (
    options.expectedEventId != null &&
    photo.album.eventId != null &&
    photo.album.eventId !== options.expectedEventId
  ) {
    throw new Error("El álbum no está relacionado con el evento seleccionado");
  }
  if (
    options.expectedEventId != null &&
    photo.album.eventId == null
  ) {
    throw new Error("El álbum no está vinculado a ningún evento");
  }

  const photographer = photo.uploadedBy ?? photo.album.user;
  const photographerName = photographer.name?.trim() || photographer.email;
  if (!photographerName && !options.allowMissingPhotographer) {
    throw new Error(
      "La fotografía no tiene autor identificado. Solo un DIRECTOR puede resolverlo.",
    );
  }

  if (!isR2Configured()) {
    throw new Error("R2 no configurado: no se puede crear copia editorial permanente");
  }

  let asset = await prisma.infoSpotEditorialAsset.findFirst({
    where: { sourceType: "CLF_PHOTO", sourcePhotoId: photo.id },
  });

  if (!asset) {
    const sourceKey = resolveClfPhotoSourceKey(photo);
    const sourceBuffer = await readR2ObjectBuffer(sourceKey);
    const editorialBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: MAX_EDITORIAL_WIDTH,
        height: MAX_EDITORIAL_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    const thumbBuffer = await sharp(editorialBuffer)
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();

    const editorialKey = `infospot/editorial/${options.articleId}/${photo.id}-w${MAX_EDITORIAL_WIDTH}.jpg`;
    const thumbKey = `infospot/editorial/${options.articleId}/${photo.id}-thumb.jpg`;

    const [{ url }, { url: thumbUrl }] = await Promise.all([
      uploadToR2(editorialBuffer, editorialKey, "image/jpeg", {
        type: "infospot_editorial",
        sourcePhotoId: String(photo.id),
      }),
      uploadToR2(thumbBuffer, thumbKey, "image/jpeg", {
        type: "infospot_editorial_thumb",
        sourcePhotoId: String(photo.id),
      }),
    ]);

    const credit = buildClfPhotoCredit(photographerName);
    const copyrightText = buildClfCopyright(photographerName);

    try {
      asset = await prisma.infoSpotEditorialAsset.create({
        data: {
          sourceType: "CLF_PHOTO",
          sourcePhotoId: photo.id,
          sourceAlbumId: photo.albumId,
          r2Key: editorialKey,
          url,
          thumbnailUrl: thumbUrl,
          photographerId: photographer.id,
          photographerName: photographerName || "Fotógrafo",
          credit,
          copyrightText,
          isPermanentEditorialAsset: true,
          importedByUserId: options.selectedByUserId,
          importedAt: new Date(),
        },
      });
    } catch {
      // Carrera: otro request creó el asset global.
      asset = await prisma.infoSpotEditorialAsset.findFirst({
        where: { sourceType: "CLF_PHOTO", sourcePhotoId: photo.id },
      });
      if (!asset) throw new Error("No se pudo crear ni recuperar el asset editorial");
    }
  } else if (!asset.isPermanentEditorialAsset) {
    asset = await prisma.infoSpotEditorialAsset.update({
      where: { id: asset.id },
      data: { isPermanentEditorialAsset: true },
    });
  }

  const link = await prisma.infoSpotArticleAsset.upsert({
    where: {
      articleId_assetId_usageType: {
        articleId: options.articleId,
        assetId: asset.id,
        usageType: options.usageType,
      },
    },
    update: {
      sortOrder: options.sortOrder ?? 0,
      captionOverride: options.captionOverride ?? undefined,
      selectedByUserId: options.selectedByUserId,
    },
    create: {
      articleId: options.articleId,
      assetId: asset.id,
      usageType: options.usageType,
      sortOrder: options.sortOrder ?? 0,
      captionOverride: options.captionOverride ?? null,
      selectedByUserId: options.selectedByUserId,
    },
  });

  if (options.usageType === "COVER") {
    await prisma.infoSpotArticle.update({
      where: { id: options.articleId },
      data: { coverImageId: asset.id },
    });
  }

  return { asset, link, reusedAsset: Boolean(asset.importedAt) };
}
