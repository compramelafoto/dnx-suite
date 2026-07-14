"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  canEditInfoSpotArticle,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import { importClfPhotoToArticle, type ImportUsage } from "@/lib/clf-import";
import { getClfAlbumDetail, getClfEventSummary } from "@/lib/clf-queries";

export type ClfActionResult =
  | { ok: true; message: string; assets?: ClfImportedAsset[] }
  | { ok: false; error: string };

export type ClfImportedAsset = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  credit: string | null;
  caption: string | null;
  photographerName: string | null;
  sourcePhotoId: number | null;
  sourceAlbumId: number | null;
};

function revalidateArticle(articleId: string, slug?: string | null) {
  revalidatePath("/redaccion");
  revalidatePath(`/redaccion/noticias/${articleId}/editar`);
  if (slug) {
    revalidatePath(`/noticias/${slug}`);
    revalidatePath("/");
  }
}

export async function linkClfEventAction(
  articleId: string,
  eventId: number | null,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };

  if (eventId != null) {
    const event = await getClfEventSummary(eventId);
    if (!event) return { ok: false, error: "Evento no encontrado" };
  }

  // Al vincular o cambiar evento, limpiar álbum para forzar re-selección coherente.
  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      eventId,
      clfAlbumId: null,
      eventLinkedByUserId: access.user.id,
      eventLinkedAt: new Date(),
    },
  });

  revalidateArticle(articleId, article.slug);
  return {
    ok: true,
    message: eventId == null ? "Evento desvinculado" : "Evento vinculado",
  };
}

export async function linkClfAlbumAction(
  articleId: string,
  albumId: number | null,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, eventId: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };

  if (albumId != null) {
    const album = await getClfAlbumDetail(albumId);
    if (!album) return { ok: false, error: "Álbum no encontrado" };
    if (article.eventId != null && album.eventId !== article.eventId) {
      return { ok: false, error: "El álbum no pertenece al evento vinculado" };
    }
    if (article.eventId == null && album.eventId != null) {
      await prisma.infoSpotArticle.update({
        where: { id: articleId },
        data: {
          eventId: album.eventId,
          clfAlbumId: albumId,
          eventLinkedByUserId: access.user.id,
          eventLinkedAt: new Date(),
        },
      });
      revalidateArticle(articleId, article.slug);
      return { ok: true, message: "Álbum y evento vinculados" };
    }
  }

  await prisma.infoSpotArticle.update({
    where: { id: articleId },
    data: {
      clfAlbumId: albumId,
      eventLinkedByUserId: access.user.id,
      eventLinkedAt: new Date(),
    },
  });

  revalidateArticle(articleId, article.slug);
  return {
    ok: true,
    message: albumId == null ? "Álbum desvinculado" : "Álbum vinculado",
  };
}

export async function importClfPhotosAction(input: {
  articleId: string;
  albumId: number;
  photoIds: number[];
  usageType: ImportUsage;
  captions?: Record<number, string>;
  /** Si true y el artículo no tiene álbum, lo vincula automáticamente. */
  autoLinkAlbum?: boolean;
}): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  let article = await prisma.infoSpotArticle.findUnique({
    where: { id: input.articleId },
    select: { id: true, slug: true, eventId: true, clfAlbumId: true },
  });
  if (!article) return { ok: false, error: "Noticia no encontrada" };
  if (article.clfAlbumId && article.clfAlbumId !== input.albumId) {
    return { ok: false, error: "Primero vinculá este álbum a la noticia" };
  }

  if (!input.photoIds.length) {
    return { ok: false, error: "Seleccioná al menos una fotografía" };
  }

  const album = await getClfAlbumDetail(input.albumId);
  if (!album) return { ok: false, error: "Álbum no encontrado" };

  if (!article.clfAlbumId && input.autoLinkAlbum !== false) {
    article = await prisma.infoSpotArticle.update({
      where: { id: input.articleId },
      data: {
        clfAlbumId: input.albumId,
        eventId: article.eventId ?? album.eventId ?? undefined,
        eventLinkedByUserId: access.user.id,
        eventLinkedAt: new Date(),
      },
      select: { id: true, slug: true, eventId: true, clfAlbumId: true },
    });
  }

  const isDirector =
    access.subject.isSuperAdmin || access.subject.role === "INFOSPOT_DIRECTOR";

  const imported: ClfImportedAsset[] = [];

  try {
    let order = 0;
    for (const photoId of input.photoIds) {
      const result = await importClfPhotoToArticle({
        articleId: input.articleId,
        photoId,
        expectedAlbumId: input.albumId,
        expectedEventId: article.eventId ?? album.eventId,
        usageType: input.usageType,
        sortOrder: order++,
        captionOverride: input.captions?.[photoId] ?? null,
        selectedByUserId: access.user.id,
        allowMissingPhotographer: isDirector,
      });
      imported.push({
        id: result.asset.id,
        url: result.asset.url,
        thumbnailUrl: result.asset.thumbnailUrl,
        credit: result.asset.credit,
        caption: result.link.captionOverride ?? result.asset.caption,
        photographerName: result.asset.photographerName,
        sourcePhotoId: result.asset.sourcePhotoId,
        sourceAlbumId: result.asset.sourceAlbumId,
      });
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Error al importar",
    };
  }

  revalidateArticle(input.articleId, article.slug);
  return {
    ok: true,
    message:
      input.usageType === "COVER"
        ? "Portada editorial guardada (copia permanente)"
        : "Fotografías editoriales importadas",
    assets: imported,
  };
}

export async function removeArticleAssetLinkAction(
  articleId: string,
  linkId: string,
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const link = await prisma.infoSpotArticleAsset.findFirst({
    where: { id: linkId, articleId },
    select: {
      id: true,
      usageType: true,
      assetId: true,
      article: { select: { slug: true, coverImageId: true } },
    },
  });
  if (!link) return { ok: false, error: "Relación no encontrada" };

  await prisma.infoSpotArticleAsset.delete({ where: { id: link.id } });

  // También retirar el usage canónico InfoSpotEditorialPhotoUsage (mismo asset).
  const usageType =
    link.usageType === "FEATURED"
      ? ("FEATURED" as const)
      : link.usageType === "COVER"
        ? ("COVER" as const)
        : link.usageType === "GALLERY"
          ? ("GALLERY" as const)
          : ("INLINE" as const);

  const editorialPhoto = await prisma.infoSpotEditorialPhoto.findFirst({
    where: { deliveryAssetId: link.assetId },
    select: { id: true },
  });
  if (editorialPhoto) {
    await prisma.infoSpotEditorialPhotoUsage.deleteMany({
      where: {
        articleId,
        photoId: editorialPhoto.id,
        usageType,
      },
    });
  }

  if (link.usageType === "COVER" && link.article.coverImageId === link.assetId) {
    await prisma.infoSpotArticle.update({
      where: { id: articleId },
      data: { coverImageId: null, coverOverridden: false },
    });
  }

  revalidateArticle(articleId, link.article.slug);
  return { ok: true, message: "Foto quitada de la nota" };
}

export async function reorderArticleAssetsAction(
  articleId: string,
  orderedLinkIds: string[],
): Promise<ClfActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotArticle(access.subject)) {
    return { ok: false, error: "Sin permiso" };
  }

  const links = await prisma.infoSpotArticleAsset.findMany({
    where: { articleId, id: { in: orderedLinkIds } },
    select: { id: true },
  });
  if (links.length !== orderedLinkIds.length) {
    return { ok: false, error: "IDs inválidos" };
  }

  await prisma.$transaction(
    orderedLinkIds.map((id, index) =>
      prisma.infoSpotArticleAsset.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  const article = await prisma.infoSpotArticle.findUnique({
    where: { id: articleId },
    select: { slug: true },
  });
  revalidateArticle(articleId, article?.slug);
  return { ok: true, message: "Orden actualizado" };
}
