/**
 * Selección / usage de fotos editoriales CLF.
 */

import { prisma, resolveClfAlbumCommercialAvailability } from "@repo/db";
import { getClfReadonlyClient } from "../clf-readonly-db";
import { isR2Configured } from "../r2-client";
import {
  isWatermarkedClfSourceKey,
  resolveClfPhotoSourceKey,
} from "../r2-read";
import {
  processEditorialDerivative,
  requestEditorialDerivative,
} from "../editorial-photo-processing";
import { linkArticleToOrigin, normalizeClfExternalIdentity } from "../content-origin";
import {
  buildEditorialPhotoCopyright,
  buildEditorialPhotoCredit,
} from "./credit";
import {
  mapClfAvailabilityToEditorialCommercial,
  resolveEditorialCommercialFromAlbum,
} from "./commercial";
import { resolveDefaultEditorialLicenseStatus } from "./license-policy";

export type SelectUsageType = "COVER" | "INLINE" | "GALLERY" | "FEATURED";

function defaultLicenseStatus(): "PENDING" | "AUTHORIZED" | "UNKNOWN" {
  return resolveDefaultEditorialLicenseStatus();
}

/**
 * Crea o reutiliza InfoSpotEditorialPhoto + opcional usage en artículo.
 * Idempotente por sourcePhotoExternalId.
 */
export async function selectEditorialPhoto(input: {
  clfPhotoId: number;
  articleId?: string | null;
  coverageId?: string | null;
  usageType?: SelectUsageType;
  sortOrder?: number;
  caption?: string | null;
  altText?: string | null;
  displaySize?: string | null;
  selectedByUserId: number;
  processNow?: boolean;
}): Promise<
  | {
      ok: true;
      photoId: string;
      usageId: string | null;
      created: boolean;
      processStatus: string;
      deliverySrc: string | null;
    }
  | { ok: false; error: string }
> {
  if (!isR2Configured()) {
    return { ok: false, error: "R2 no configurado: no se pueden generar derivados." };
  }

  const clf = getClfReadonlyClient();
  const photo = await clf.photo.findFirst({
    where: {
      id: input.clfPhotoId,
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
          publicSlug: true,
          isPublic: true,
          isHidden: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          eventId: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!photo) return { ok: false, error: "Fotografía no encontrada en CLF." };
  if (photo.album.deletedAt) {
    return { ok: false, error: "El álbum de origen está eliminado." };
  }

  const photographer = photo.uploadedBy ?? photo.album.user;
  const photographerName = photographer.name?.trim() || photographer.email;
  if (!photographerName) {
    return { ok: false, error: "La fotografía no tiene autor identificado." };
  }

  const commercial = resolveEditorialCommercialFromAlbum({
    publicSlug: photo.album.publicSlug,
    isHidden: photo.album.isHidden,
    isPublic: photo.album.isPublic,
    deletedAt: photo.album.deletedAt,
    firstPhotoDate: photo.album.firstPhotoDate,
    createdAt: photo.album.createdAt,
    expirationExtensionDays: photo.album.expirationExtensionDays,
    cleanupStatus: photo.album.cleanupStatus,
  });

  let sourceKey: string;
  try {
    sourceKey = resolveClfPhotoSourceKey(photo);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Sin original editorial disponible.",
    };
  }
  if (isWatermarkedClfSourceKey(sourceKey)) {
    return {
      ok: false,
      error:
        "Esta foto solo tiene preview con marca de agua. No se puede publicar hasta que exista el original en CLF.",
    };
  }
  const credit = buildEditorialPhotoCredit({ photographerName });
  const copyrightText = buildEditorialPhotoCopyright(photographerName);
  const externalId = String(photo.id);

  // InfoSpotEvent id (cuid) if we have coverage/article linkage — soft clf event id stored separately
  let infoSpotEventId: string | null = null;
  if (input.articleId) {
    const art = await prisma.infoSpotArticle.findUnique({
      where: { id: input.articleId },
      select: { id: true },
    });
    if (!art) return { ok: false, error: "Artículo no encontrado." };
  }

  if (input.coverageId) {
    const cov = await prisma.infoSpotCoverage.findUnique({
      where: { id: input.coverageId },
      select: { id: true, clfEventId: true },
    });
    if (!cov) return { ok: false, error: "Cobertura no encontrada." };
    // clfEventId es Int CLF; InfoSpotEditorialPhoto.eventId es cuid de InfoSpotEvent.
    infoSpotEventId = null;
  }

  const existing = await prisma.infoSpotEditorialPhoto.findUnique({
    where: { sourcePhotoExternalId: externalId },
    include: { variants: true },
  });

  const previousSourceKey = existing?.sourceStorageKey ?? null;
  const sourceChanged =
    Boolean(previousSourceKey) && previousSourceKey !== sourceKey;

  let created = false;
  let editorialPhoto =
    existing ??
    (await prisma.infoSpotEditorialPhoto.create({
      data: {
        coverageId: input.coverageId ?? null,
        eventId: infoSpotEventId,
        sourcePhotoExternalId: externalId,
        sourceAlbumExternalId: String(photo.albumId),
        photographerExternalId: photographer.id ? String(photographer.id) : null,
        photographerUserId: photographer.id,
        photographerName,
        photographerProfileUrl: null,
        albumUrl: commercial.albumUrl,
        purchaseUrl: commercial.purchaseUrl,
        commercialStatus: commercial.status,
        editorialLicenseStatus: defaultLicenseStatus(),
        editorialUsageStatus: "ACTIVE",
        processStatus: "PENDING",
        sourceStorageKey: sourceKey,
        credit,
        copyrightText,
        lastSyncedAt: new Date(),
      },
      include: { variants: true },
    }));

  if (!existing) created = true;
  else {
    editorialPhoto = await prisma.infoSpotEditorialPhoto.update({
      where: { id: existing.id },
      data: {
        coverageId: input.coverageId ?? existing.coverageId,
        photographerName,
        photographerUserId: photographer.id,
        photographerExternalId: String(photographer.id),
        albumUrl: commercial.albumUrl,
        purchaseUrl: commercial.purchaseUrl,
        commercialStatus: commercial.status,
        // Siempre refrescar a original limpio (sin watermark).
        sourceStorageKey: sourceKey,
        credit: existing.credit || credit,
        copyrightText: existing.copyrightText || copyrightText,
        lastSyncedAt: new Date(),
        ...(sourceChanged
          ? { processStatus: "PENDING" as const, processError: null }
          : {}),
      },
      include: { variants: true },
    });
  }

  // ContentOrigin PHOTO → article (si hay artículo)
  if (input.articleId) {
    const identity = normalizeClfExternalIdentity("PHOTO", photo.id);
    await linkArticleToOrigin(input.articleId, {
      sourceType: "COMPRAMELAFOTO",
      externalEntityType: "PHOTO",
      externalId: identity.externalId,
      externalUrl: commercial.purchaseUrl,
      direction: "INBOUND",
      operationalPayload: {
        photoId: photo.id,
        albumId: photo.albumId,
        publicSlug: photo.album.publicSlug,
        commercialStatus: commercial.status,
      },
    });
  }

  const processNow = input.processNow !== false;
  const needsProcess =
    processNow &&
    (sourceChanged ||
      editorialPhoto.processStatus === "PENDING" ||
      editorialPhoto.processStatus === "FAILED" ||
      editorialPhoto.variants.length === 0 ||
      // Reprocesar si aún apunta a path legacy con watermark (pre-clean).
      editorialPhoto.variants.some(
        (v) =>
          v.r2Key.includes(`/clf/${externalId}/w`) &&
          !v.r2Key.includes(`/clf/${externalId}/clean/`),
      ));

  if (needsProcess) {
    await processEditorialDerivative(editorialPhoto.id);
    editorialPhoto = (await prisma.infoSpotEditorialPhoto.findUnique({
      where: { id: editorialPhoto.id },
      include: { variants: true },
    }))!;
  }

  let usageId: string | null = null;
  if (input.articleId && input.usageType) {
    const usage = await prisma.infoSpotEditorialPhotoUsage.upsert({
      where: {
        articleId_photoId_usageType: {
          articleId: input.articleId,
          photoId: editorialPhoto.id,
          usageType: input.usageType,
        },
      },
      create: {
        articleId: input.articleId,
        photoId: editorialPhoto.id,
        usageType: input.usageType,
        sortOrder: input.sortOrder ?? 0,
        caption: input.caption ?? null,
        altText: input.altText ?? null,
        isCover: input.usageType === "COVER",
        displaySize: input.displaySize ?? "wide",
        createdByUserId: input.selectedByUserId,
      },
      update: {
        sortOrder: input.sortOrder ?? 0,
        caption: input.caption ?? undefined,
        altText: input.altText ?? undefined,
        isCover: input.usageType === "COVER",
        displaySize: input.displaySize ?? "wide",
        createdByUserId: input.selectedByUserId,
      },
    });
    usageId = usage.id;

    // Compat ArticleAsset + cover
    if (editorialPhoto.deliveryAssetId) {
      await prisma.infoSpotArticleAsset.upsert({
        where: {
          articleId_assetId_usageType: {
            articleId: input.articleId,
            assetId: editorialPhoto.deliveryAssetId,
            usageType:
              input.usageType === "FEATURED" ? "FEATURED" : input.usageType,
          },
        },
        create: {
          articleId: input.articleId,
          assetId: editorialPhoto.deliveryAssetId,
          usageType:
            input.usageType === "FEATURED" ? "FEATURED" : input.usageType,
          sortOrder: input.sortOrder ?? 0,
          captionOverride: input.caption ?? null,
          selectedByUserId: input.selectedByUserId,
        },
        update: {
          sortOrder: input.sortOrder ?? 0,
          captionOverride: input.caption ?? null,
          selectedByUserId: input.selectedByUserId,
        },
      });

      if (input.usageType === "COVER") {
        await prisma.infoSpotArticle.update({
          where: { id: input.articleId },
          data: {
            coverImageId: editorialPhoto.deliveryAssetId,
            coverOverridden: true,
            clfAlbumId: photo.albumId,
          },
        });
      }
    }
  }

  const delivery =
    editorialPhoto.variants.find((v) => v.format === "webp" && v.width >= 960) ||
    editorialPhoto.variants.find((v) => v.format === "webp") ||
    editorialPhoto.variants[0];

  return {
    ok: true,
    photoId: editorialPhoto.id,
    usageId,
    created,
    processStatus: editorialPhoto.processStatus,
    deliverySrc: delivery?.url ?? null,
  };
}

export async function removeEditorialPhotoUsage(input: {
  usageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
    where: { id: input.usageId },
    include: { photo: true },
  });
  if (!usage) return { ok: false, error: "Uso no encontrado." };

  await prisma.infoSpotEditorialPhotoUsage.delete({ where: { id: usage.id } });

  // Compat: también quitar el ArticleAsset legacy del mismo vínculo.
  if (usage.photo.deliveryAssetId) {
    const legacyUsage =
      usage.usageType === "FEATURED"
        ? "FEATURED"
        : usage.usageType === "COVER"
          ? "COVER"
          : usage.usageType === "GALLERY"
            ? "GALLERY"
            : "INLINE";
    await prisma.infoSpotArticleAsset.deleteMany({
      where: {
        articleId: usage.articleId,
        assetId: usage.photo.deliveryAssetId,
        usageType: legacyUsage,
      },
    });
  }

  if (usage.isCover || usage.usageType === "COVER") {
    const article = await prisma.infoSpotArticle.findUnique({
      where: { id: usage.articleId },
      select: { coverImageId: true },
    });
    if (article?.coverImageId && usage.photo.deliveryAssetId === article.coverImageId) {
      await prisma.infoSpotArticle.update({
        where: { id: usage.articleId },
        data: { coverImageId: null, coverOverridden: false },
      });
    }
  }

  return { ok: true };
}

export async function retryEditorialPhotoDerivative(photoId: string) {
  const editorial = await prisma.infoSpotEditorialPhoto.findUnique({
    where: { id: photoId },
    select: { id: true, sourcePhotoExternalId: true },
  });
  if (!editorial) return { ok: false as const, error: "Foto editorial no encontrada" };

  const clfPhotoId = Number(editorial.sourcePhotoExternalId);
  if (Number.isFinite(clfPhotoId) && clfPhotoId > 0) {
    try {
      const clf = getClfReadonlyClient();
      const photo = await clf.photo.findFirst({
        where: { id: clfPhotoId, isRemoved: false, storageDeletedAt: null },
        select: {
          originalKey: true,
          previewUrl: true,
          previewWatermarkedKey: true,
          thumbWatermarkedKey: true,
        },
      });
      if (photo) {
        const sourceKey = resolveClfPhotoSourceKey(photo);
        await prisma.infoSpotEditorialPhoto.update({
          where: { id: photoId },
          data: { sourceStorageKey: sourceKey },
        });
      }
    } catch {
      // Si CLF no está disponible, reintenta con la key ya guardada.
    }
  }

  return requestEditorialDerivative(photoId);
}

export async function updateEditorialCoverFocal(input: {
  usageId: string;
  focalX: number;
  focalY: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
    where: { id: input.usageId },
    select: { id: true, usageType: true },
  });
  if (!usage) return { ok: false, error: "Uso no encontrado." };
  if (usage.usageType !== "COVER") {
    return { ok: false, error: "El encuadre solo aplica a la portada." };
  }
  const focalX = Math.min(1, Math.max(0, input.focalX));
  const focalY = Math.min(1, Math.max(0, input.focalY));
  await prisma.infoSpotEditorialPhotoUsage.update({
    where: { id: input.usageId },
    data: { focalX, focalY },
  });
  return { ok: true };
}

/** Actualiza descripción (alt text) y/o epígrafe de un uso editorial. */
export async function updateEditorialPhotoUsageMeta(input: {
  usageId: string;
  altText?: string | null;
  caption?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const usage = await prisma.infoSpotEditorialPhotoUsage.findUnique({
    where: { id: input.usageId },
    select: { id: true, photo: { select: { deliveryAssetId: true } }, articleId: true },
  });
  if (!usage) return { ok: false, error: "Uso no encontrado." };

  const altText =
    input.altText !== undefined
      ? input.altText?.trim() || null
      : undefined;
  const caption =
    input.caption !== undefined
      ? input.caption?.trim() || null
      : undefined;

  await prisma.infoSpotEditorialPhotoUsage.update({
    where: { id: input.usageId },
    data: {
      ...(altText !== undefined ? { altText } : {}),
      ...(caption !== undefined ? { caption } : {}),
    },
  });

  if (caption !== undefined && usage.photo.deliveryAssetId) {
    await prisma.infoSpotArticleAsset.updateMany({
      where: {
        articleId: usage.articleId,
        assetId: usage.photo.deliveryAssetId,
      },
      data: { captionOverride: caption },
    });
  }

  return { ok: true };
}

export async function reorderGalleryUsages(input: {
  articleId: string;
  orderedUsageIds: string[];
}) {
  await prisma.$transaction(
    input.orderedUsageIds.map((id, index) =>
      prisma.infoSpotEditorialPhotoUsage.updateMany({
        where: {
          id,
          articleId: input.articleId,
          usageType: "GALLERY",
        },
        data: { sortOrder: index },
      }),
    ),
  );
}

export { mapClfAvailabilityToEditorialCommercial, resolveClfAlbumCommercialAvailability };
